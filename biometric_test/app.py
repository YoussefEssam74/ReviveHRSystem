"""
Revive HR System - Biometric Inference Service for Cloud & Render Deployment
Provides:
- YuNet Face Detection
- Silent-Face Anti-Spoofing & Liveness Verification
- SFace 1-to-N Face Recognition (Cosine Embeddings)
- Browser Webcam Frame Processing (Client-to-Cloud)
"""

import os
import sys
import time
import json
import base64
import threading
import cv2
import numpy as np
import torch
from fastapi import FastAPI, Response, Query, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
YUNET_PATH = os.path.join(SCRIPT_DIR, "face_detection_yunet.onnx")
SFACE_PATH = os.path.join(SCRIPT_DIR, "face_recognition_sface.onnx")
ENROLLED_FACES_FILE = os.path.join(SCRIPT_DIR, "enrolled_faces.json")

# Import the Anti-Spoofing Engine
from anti_spoofing_engine import AntiSpoofingEngine

# Verification Thresholds
COSINE_THRESHOLD = 0.50
LIVENESS_THRESHOLD = 0.60

# Initialize OpenCV Zoo Models
detector = cv2.FaceDetectorYN.create(
    model=YUNET_PATH,
    config="",
    input_size=(320, 320),
    score_threshold=0.75,
    nms_threshold=0.3,
    top_k=5000
)

recognizer = cv2.FaceRecognizerSF.create(
    model=SFACE_PATH,
    config=""
)

# Initialize Anti-Spoofing Engine (CPU or GPU)
device = "cuda:0" if torch.cuda.is_available() else "cpu"
anti_spoof = AntiSpoofingEngine(device=device)

# Employee Database with disk persistence
employee_db = {}
db_lock = threading.Lock()

def load_enrolled_faces():
    global employee_db
    if not os.path.exists(ENROLLED_FACES_FILE):
        return
    try:
        with open(ENROLLED_FACES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            with db_lock:
                for item in data:
                    emp_id = item["id"]
                    feat = np.array(item["feature"], dtype=np.float32).reshape(1, 128)
                    employee_db[emp_id] = {
                        "id": emp_id,
                        "employee_code": item.get("employee_code", emp_id),
                        "name": item["name"],
                        "feature": feat,
                        "thumb": item.get("thumb", ""),
                        "enrolled_at": item.get("enrolled_at", "")
                    }
        print(f"[*] Loaded {len(employee_db)} enrolled faces from disk.")
    except Exception as e:
        print(f"[-] Error loading enrolled faces: {e}")

load_enrolled_faces()

def save_enrolled_faces():
    with db_lock:
        data = []
        for emp_id, emp_data in employee_db.items():
            feat_list = emp_data["feature"].flatten().tolist()
            data.append({
                "id": emp_id,
                "employee_code": emp_data.get("employee_code", emp_id),
                "name": emp_data["name"],
                "feature": feat_list,
                "thumb": emp_data.get("thumb", ""),
                "enrolled_at": emp_data.get("enrolled_at", "")
            })
    try:
        with open(ENROLLED_FACES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[*] Persisted {len(data)} enrolled faces to {ENROLLED_FACES_FILE}")
    except Exception as e:
        print(f"[-] Error saving enrolled faces: {e}")

def decode_base64_image(b64_str: str):
    if not b64_str:
        return None
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

app = FastAPI(title="Revive HR Biometric Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FramePayload(BaseModel):
    image: str

class EnrollPayload(BaseModel):
    image: str
    name: str
    employee_code: str = ""

@app.on_event("startup")
def startup_event():
    load_enrolled_faces()

@app.get("/ping")
def ping():
    return {
        "status": "online",
        "service": "Revive HR Biometrics",
        "version": "2.0-cloud",
        "device": device,
        "enrolled_count": len(employee_db),
        "timestamp": time.time()
    }

@app.get("/status")
def status():
    return {
        "total_enrolled": len(employee_db),
        "threshold": COSINE_THRESHOLD,
        "liveness_threshold": LIVENESS_THRESHOLD,
        "service": "online",
        "device": device,
        "fps": "Cloud API",
        "timestamp": time.time()
    }

@app.post("/process_frame")
def process_frame(payload: FramePayload):
    frame = decode_base64_image(payload.image)
    if frame is None:
        return JSONResponse({"error": "Invalid image data"}, status_code=400)

    fh, fw, _ = frame.shape
    detector.setInputSize((fw, fh))
    _, faces = detector.detect(frame)

    if faces is None or len(faces) == 0:
        return {
            "face_detected": False,
            "is_live": False,
            "liveness_score": 0.0,
            "is_match": False,
            "recognized_name": None,
            "recognized_id": None,
            "similarity": 0.0,
            "status": "SEARCHING"
        }

    face = faces[0]
    bbox = face[0:4].astype(int).tolist()
    x, y, w, h = bbox
    x = max(0, x)
    y = max(0, y)
    w = min(w, fw - x)
    h = min(h, fh - y)

    # 1. Anti-Spoofing Liveness Check
    is_live, liveness_score, _ = anti_spoof.check_liveness(frame, [x, y, w, h])

    # 2. SFace Recognition Feature Extraction
    aligned = recognizer.alignCrop(frame, face)
    current_feat = recognizer.feature(aligned)

    best_name = None
    best_id = None
    best_score = 0.0
    matched = False

    if is_live:
        with db_lock:
            for emp_key, emp_data in employee_db.items():
                sim = float(recognizer.match(emp_data["feature"], current_feat, cv2.FaceRecognizerSF_FR_COSINE))
                if sim > best_score:
                    best_score = sim
                    best_name = emp_data["name"]
                    best_id = emp_data.get("employee_code", emp_key)

            if best_score >= COSINE_THRESHOLD:
                matched = True

    status_tag = "SPOOF" if not is_live else ("MATCHED" if matched else "UNKNOWN")

    return {
        "face_detected": True,
        "bbox": [x, y, w, h],
        "is_live": bool(is_live),
        "liveness_score": round(float(liveness_score), 3),
        "is_match": bool(matched),
        "recognized_name": best_name if matched else None,
        "recognized_id": best_id if matched else None,
        "similarity": round(float(best_score), 3),
        "status": status_tag
    }

@app.post("/enroll_frame")
def enroll_frame(payload: EnrollPayload):
    clean_name = payload.name.strip()
    clean_code = payload.employee_code.strip()
    if not clean_name:
        return JSONResponse({"success": False, "message": "Please enter a valid employee name."}, status_code=400)

    frame = decode_base64_image(payload.image)
    if frame is None:
        return JSONResponse({"success": False, "message": "Invalid image"}, status_code=400)

    fh, fw, _ = frame.shape
    detector.setInputSize((fw, fh))
    _, faces = detector.detect(frame)

    if faces is None or len(faces) == 0:
        return JSONResponse({"success": False, "message": "No face detected in camera!"})

    face = faces[0]
    bbox = face[0:4].astype(int).tolist()
    x, y, w, h = bbox
    x = max(0, x)
    y = max(0, y)
    w = min(w, fw - x)
    h = min(h, fh - y)

    is_live, score, _ = anti_spoof.check_liveness(frame, [x, y, w, h])
    if not is_live or score < LIVENESS_THRESHOLD:
        return JSONResponse({
            "success": False,
            "message": f"⚠️ ENROLLMENT REJECTED: Liveness failed ({round(score*100)}% real). You cannot enroll using a photo or phone screen."
        })

    aligned = recognizer.alignCrop(frame, face)
    current_feat = recognizer.feature(aligned)

    _, thumb_buf = cv2.imencode('.jpg', aligned)
    thumb_b64 = f"data:image/jpeg;base64,{base64.b64encode(thumb_buf).decode('utf-8')}"

    emp_id = clean_code if clean_code else str(int(time.time() * 1000))
    emp_code = clean_code if clean_code else emp_id

    with db_lock:
        employee_db[emp_id] = {
            "id": emp_id,
            "employee_code": emp_code,
            "name": clean_name,
            "feature": np.copy(current_feat),
            "thumb": thumb_b64,
            "enrolled_at": time.strftime("%H:%M:%S")
        }

    save_enrolled_faces()

    return {
        "success": True,
        "message": f"Verified live person! Successfully enrolled '{clean_name}' ({emp_code}).",
        "employee": {
            "id": emp_id,
            "employee_code": emp_code,
            "name": clean_name
        }
    }

@app.post("/enroll")
def enroll_alias(payload: EnrollPayload):
    return enroll_frame(payload)

@app.get("/employees")
def list_employees():
    with db_lock:
        return [
            {
                "id": data["id"],
                "employee_code": data.get("employee_code", data["id"]),
                "name": data["name"],
                "thumb": data["thumb"],
                "enrolled_at": data["enrolled_at"]
            }
            for data in employee_db.values()
        ]

@app.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    with db_lock:
        if emp_id in employee_db:
            deleted_name = employee_db[emp_id]["name"]
            del employee_db[emp_id]
            save_enrolled_faces()
            return {"success": True, "message": f"Deleted {deleted_name}"}
    return {"success": False, "message": "Employee not found"}

@app.post("/set_threshold")
def set_threshold(val: float):
    global COSINE_THRESHOLD
    COSINE_THRESHOLD = float(val)
    return {"threshold": COSINE_THRESHOLD}

@app.get("/", response_class=HTMLResponse)
def index():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Revive HR — Biometric AI Cloud Service</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body class="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
  <div class="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
    <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
      <span class="material-icons text-3xl">fingerprint</span>
    </div>
    <h1 class="text-2xl font-bold text-white">Revive HR Biometric Service</h1>
    <p class="text-sm text-slate-400 mt-1">Cloud API for Attendance Station</p>
    
    <div class="mt-6 grid grid-cols-3 gap-3 text-left">
      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <p class="text-[10px] uppercase font-bold text-slate-500">Detector</p>
        <p class="text-xs font-semibold text-emerald-400">YuNet ONNX</p>
      </div>
      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <p class="text-[10px] uppercase font-bold text-slate-500">Anti-Spoof</p>
        <p class="text-xs font-semibold text-emerald-400">Silent-Face</p>
      </div>
      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <p class="text-[10px] uppercase font-bold text-slate-500">Recognizer</p>
        <p class="text-xs font-semibold text-emerald-400">SFace 128-d</p>
      </div>
    </div>

    <div class="mt-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-left">
      <div class="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        API Active & Ready for Client Testing
      </div>
      <p class="text-xs text-slate-300">This service accepts POST requests from the Vercel Attendance Station at <code class="text-emerald-400 font-mono">/process_frame</code>.</p>
    </div>
  </div>
</body>
</html>"""

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    print(f"[*] Starting Revive HR Biometric Service on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
