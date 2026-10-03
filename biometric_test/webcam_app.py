"""
  Revive HR System - Multi-Employee Biometric Kiosk + Silent-Face Anti-Spoofing
  Combines:
  1. Face Detection: OpenCV Zoo YuNet
  2. Anti-Spoofing & Liveness Detection: MiniVision Silent-Face-Anti-Spoofing (Dual MiniFASNet)
  3. 1-to-N Recognition: OpenCV Zoo SFace (128-d cosine embeddings)
  """

from anti_spoofing_engine import AntiSpoofingEngine
import os
import sys
import time
import json
import base64
import threading
import cv2
import numpy as np
from fastapi import FastAPI, Response, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
YUNET_PATH = os.path.join(SCRIPT_DIR, "face_detection_yunet.onnx")
SFACE_PATH = os.path.join(SCRIPT_DIR, "face_recognition_sface.onnx")
ENROLLED_FACES_FILE = os.path.join(SCRIPT_DIR, "enrolled_faces.json")

# Import the GPU-accelerated Anti-Spoofing Engine

# Verification Threshold (Default 0.50)
COSINE_THRESHOLD = 0.50
LIVENESS_THRESHOLD = 0.60  # Minimum real face probability

# Initialize Models
detector = cv2.FaceDetectorYN.create(
    model=YUNET_PATH,
    config="",
    input_size=(320, 320),
    score_threshold=0.8,
    nms_threshold=0.3,
    top_k=5000
)

recognizer = cv2.FaceRecognizerSF.create(
    model=SFACE_PATH,
    config=""
)

# Initialize Anti-Spoofing Engine
anti_spoof = AntiSpoofingEngine()

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
                    feat = np.array(item["feature"],
                                    dtype=np.float32).reshape(1, 128)
                    employee_db[emp_id] = {
                        "id": emp_id,
                        "employee_code": item.get("employee_code", emp_id),
                        "name": item["name"],
                        "feature": feat,
                        "thumb": item.get("thumb", ""),
                        "enrolled_at": item.get("enrolled_at", "")
                    }
        print(
            f"[*] Loaded {len(employee_db)} enrolled faces from {ENROLLED_FACES_FILE}")
    except Exception as e:
        print(f"[-] Error loading enrolled faces: {e}")


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
        print(
            f"[*] Persisted {len(data)} enrolled faces to {ENROLLED_FACES_FILE}")
    except Exception as e:
        print(f"[-] Error saving enrolled faces: {e}")


class LiveState:
    recognized_name = None
    recognized_id = None
    similarity = 0.0
    is_match = False
    is_live = False
    liveness_score = 0.0
    fps = 0.0
    face_detected = False
    bbox = None


live_state = LiveState()
state_lock = threading.Lock()


class CameraStream:
    def __init__(self):
        self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.latest_frame = None
        self.running = True
        self.current_face_crop = None
        self.current_face_feature = None
        self.current_is_live = False
        self.current_liveness_score = 0.0

        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _capture_loop(self):
        prev_time = time.time()
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            fh, fw, _ = frame.shape
            detector.setInputSize((fw, fh))
            _, faces = detector.detect(frame)

            curr_time = time.time()
            fps = 1.0 / max(0.001, (curr_time - prev_time))
            prev_time = curr_time

            with state_lock:
                live_state.fps = round(fps, 1)

            if faces is not None and len(faces) > 0:
                face = faces[0]
                bbox = face[0:4].astype(int)
                x, y, w, h = bbox

                # Ensure valid bbox bounds
                x = max(0, x)
                y = max(0, y)
                w = min(w, fw - x)
                h = min(h, fh - y)

                # 1. RUN LIVENESS / ANTI-SPOOFING CHECK
                is_live, liveness_score, _ = anti_spoof.check_liveness(frame, [
                                                                       x, y, w, h])
                self.current_is_live = is_live
                self.current_liveness_score = liveness_score

                # 2. EXTRACT RECOGNITION FEATURES
                aligned = recognizer.alignCrop(frame, face)
                current_feat = recognizer.feature(aligned)
                self.current_face_feature = current_feat
                self.current_face_crop = aligned

                best_name = None
                best_id = None
                best_score = 0.0
                matched = False

                if is_live:
                    # 3. 1-to-N MATCHING (ONLY IF LIVE HUMAN)
                    with db_lock:
                        if len(employee_db) > 0:
                            for emp_key, emp_data in employee_db.items():
                                sim = float(recognizer.match(
                                    emp_data["feature"], current_feat, cv2.FaceRecognizerSF_FR_COSINE))
                                if sim > best_score:
                                    best_score = sim
                                    best_name = emp_data["name"]
                                    best_id = emp_data.get(
                                        "employee_code", emp_key)

                            if best_score >= COSINE_THRESHOLD:
                                matched = True

                with state_lock:
                    live_state.face_detected = True
                    live_state.is_live = is_live
                    live_state.liveness_score = round(liveness_score, 3)
                    live_state.similarity = round(best_score, 3)
                    live_state.is_match = matched
                    live_state.recognized_name = best_name if matched else None
                    live_state.recognized_id = best_id if matched else None
                    live_state.bbox = [int(x), int(y), int(w), int(h)]

                # 4. DRAW SECURITY VISUALS
                if not is_live:
                    # SPOOF DETECTED (Screen / Photo / Fake)
                    box_color = (0, 0, 230)  # Bright Red
                    badge = f"SPOOF DETECTED! (Fake {1.0 - liveness_score:.2f})"
                elif matched:
                    # VERIFIED LIVE EMPLOYEE
                    box_color = (46, 204, 113)  # Green
                    badge = f"{best_name} ({best_id}) | LIVE ({best_score:.2f})" if best_id else f"{best_name} | LIVE ({best_score:.2f})"
                elif len(employee_db) > 0:
                    # LIVE PERSON BUT UNKNOWN
                    box_color = (52, 152, 219)  # Orange / Blue
                    badge = f"UNKNOWN | LIVE ({liveness_score:.2f})"
                else:
                    # NO EMPLOYEES ENROLLED YET
                    box_color = (0, 215, 255)  # Amber
                    badge = f"LIVE HUMAN ({liveness_score:.2f})"

                # Draw Bounding Box & Header Badge
                cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 2)
                cv2.rectangle(frame, (x, max(0, y - 32)),
                              (x + w, y), box_color, -1)
                cv2.putText(frame, badge, (x + 8, max(20, y - 8)),
                            cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

                # Draw 5 facial landmarks
                landmarks = face[4:14].reshape((5, 2)).astype(int)
                for pt in landmarks:
                    cv2.circle(frame, tuple(pt), 3,
                               (0, 255, 255), -1, cv2.LINE_AA)
            else:
                with state_lock:
                    live_state.face_detected = False
                    live_state.is_live = False
                    live_state.is_match = False
                    live_state.recognized_name = None
                    live_state.recognized_id = None
                    live_state.bbox = None
                    self.current_face_feature = None
                    self.current_face_crop = None

            # Overlay stats header
            status_tag = "LIVE" if live_state.is_live else "NO FACE / SPOOF"
            cv2.putText(frame, f"Revive BioSecurity: YuNet + Silent-Face + SFace | FPS: {live_state.fps}",
                        (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA)

            self.latest_frame = frame

    def get_jpeg(self):
        if self.latest_frame is None:
            return None
        _, jpeg = cv2.imencode('.jpg', self.latest_frame, [
                               int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return jpeg.tobytes()


app = FastAPI(title="Revive HR Anti-Spoof Biometric Kiosk")

# Enable CORS for Attendance Station kiosk and any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Attendance Station UI if found
STATION_DIR = os.path.abspath(os.path.join(
    SCRIPT_DIR, "..", "Mock UI", "Attendance Station"))
if os.path.exists(STATION_DIR):
    app.mount("/station", StaticFiles(directory=STATION_DIR,
              html=True), name="station")

camera = None


def generate_frames():
    global camera
    while True:
        if camera is not None:
            frame_bytes = camera.get_jpeg()
            if frame_bytes is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.033)


@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/ping")
def ping():
    return {
        "status": "online",
        "service": "Revive HR Biometrics",
        "version": "2.0",
        "timestamp": time.time()
    }


@app.post("/enroll")
def enroll_employee(name: str = Query(..., min_length=1), employee_code: str = Query("")):
    global camera
    clean_name = name.strip()
    clean_code = employee_code.strip()
    if not clean_name:
        return JSONResponse({"success": False, "message": "Please enter a valid employee name."})

    if camera is None or camera.current_face_feature is None or camera.current_face_crop is None:
        return JSONResponse({"success": False, "message": "No face detected in camera! Please look into the camera."})

    # ANTI-SPOOF GATE: Deny enrolling photos / screens
    if not camera.current_is_live:
        return JSONResponse({
            "success": False,
            "message": "⚠️ ENROLLMENT REJECTED: Liveness check failed! You cannot enroll using a photo or smartphone screen. A live human must be present."
        })

    _, thumb_buf = cv2.imencode('.jpg', camera.current_face_crop)
    thumb_b64 = base64.b64encode(thumb_buf).decode('utf-8')

    emp_id = clean_code if clean_code else str(int(time.time() * 1000))
    emp_code = clean_code if clean_code else emp_id

    with db_lock:
        employee_db[emp_id] = {
            "id": emp_id,
            "employee_code": emp_code,
            "name": clean_name,
            "feature": np.copy(camera.current_face_feature),
            "thumb": f"data:image/jpeg;base64,{thumb_b64}",
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


@app.get("/status")
def get_status():
    with state_lock:
        return {
            "total_enrolled": len(employee_db),
            "recognized_name": live_state.recognized_name,
            "recognized_id": getattr(live_state, "recognized_id", None),
            "similarity": live_state.similarity,
            "is_match": live_state.is_match,
            "is_live": live_state.is_live,
            "liveness_score": live_state.liveness_score,
            "fps": live_state.fps,
            "face_detected": live_state.face_detected,
            "bbox": getattr(live_state, "bbox", None),
            "threshold": COSINE_THRESHOLD,
            "timestamp": time.time()
        }


@app.get("/")
def root_redirect():
    if os.path.exists(STATION_DIR):
        return RedirectResponse(url="/station/")
    return RedirectResponse(url="/monitor")


@app.get("/monitor", response_class=HTMLResponse)
def monitor():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Revive HR System - Face Recognition & Anti-Spoofing</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #090d16;
      color: #f1f5f9;
      min-height: 100vh;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      padding: 5px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    h1 { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
    p.subtitle { font-size: 13px; color: #94a3b8; }
    
    .layout-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      width: 100%;
      max-width: 1120px;
    }
    @media (min-width: 900px) {
      .layout-grid { grid-template-columns: 640px 1fr; }
    }

    .video-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
    }
    .video-stream {
      width: 100%;
      height: 480px;
      object-fit: cover;
      display: block;
      background: #000;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 16px;
    }

    .status-badge {
      padding: 14px;
      border-radius: 12px;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid #334155;
      background: #1e293b;
      transition: all 0.25s ease;
    }
    .status-badge.matched {
      background: rgba(16, 185, 129, 0.12);
      border-color: #10b981;
      color: #34d399;
    }
    .status-badge.spoof {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #fca5a5;
      animation: pulse 1s infinite alternate;
    }
    .status-badge.unknown {
      background: rgba(245, 158, 11, 0.12);
      border-color: #f59e0b;
      color: #fcd34d;
    }
    .status-badge.idle {
      background: rgba(148, 163, 184, 0.1);
      border-color: #334155;
      color: #94a3b8;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      100% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.0); }
    }

    .security-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #131c2e;
      border: 1px solid #1e293b;
      padding: 10px 14px;
      border-radius: 10px;
    }
    .security-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .security-pill.live {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .security-pill.fake {
      background: rgba(239, 68, 68, 0.25);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.5);
    }

    .stat-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
    .stat-value { font-size: 19px; font-weight: 800; }

    .input-group {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    input[type="text"] {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
    }
    input[type="text"]:focus {
      border-color: #38bdf8;
    }
    .btn {
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-primary { background: #0284c7; color: #fff; }
    .btn-primary:hover { background: #0369a1; }
    .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.4); }

    .employee-list {
      max-height: 150px;
      overflow-y: auto;
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .employee-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1e293b;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .emp-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .emp-thumb {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid #38bdf8;
    }
    .emp-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
    .emp-time { font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Revive Solutions Fitness &bull; Anti-Spoof Biometric Gate</div>
    <h1>Face Recognition + Anti-Spoofing (Liveness)</h1>
    <p class="subtitle">OpenCV Zoo (YuNet + SFace) + MiniVision Silent-Face-Anti-Spoofing</p>
  </div>

  <div class="layout-grid">
    <div class="video-card">
      <img class="video-stream" src="/video_feed" alt="Biometric Stream">
    </div>

    <div class="sidebar">
      <!-- Attendance Status -->
      <div id="statusBadge" class="status-badge idle">
        <div class="stat-title">Attendance State</div>
        <div id="statusText" class="stat-value">Awaiting Face</div>
        <div id="statusSub" style="font-size: 12px; opacity: 0.9;">No one in front of camera</div>
      </div>

      <!-- Real-Time Liveness Indicator -->
      <div class="security-badge">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Liveness Security</div>
          <div id="livenessScore" style="font-size: 14px; font-weight: 800; color: #f8fafc;">Awaiting Analysis</div>
        </div>
        <div id="securityPill" class="security-pill live">Active</div>
      </div>

      <!-- Enrollment Form -->
      <div class="card">
        <div style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Enroll Verified Employee</div>
        <div class="input-group">
          <input type="text" id="empNameInput" placeholder="Employee Name (e.g. Youssef)" />
          <button class="btn btn-primary" onclick="enrollEmployee()">📸 Enroll</button>
        </div>
      </div>

      <!-- Sensitivity / Threshold Slider -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 6px;">
          <span>Match Threshold</span>
          <span id="sliderVal" style="color: #38bdf8;">0.50</span>
        </div>
        <input type="range" id="thresholdSlider" min="0.30" max="0.75" step="0.05" value="0.50" 
               style="width: 100%; accent-color: #0284c7; cursor: pointer;" oninput="updateThreshold(this.value)">
      </div>

      <!-- Enrolled Staff -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #e2e8f0;">
          <span>Enrolled Database</span>
          <span id="enrolledCount" style="color: #38bdf8;">0</span>
        </div>
        <div id="employeeList" class="employee-list">
          <div style="font-size: 12px; color: #64748b; text-align: center; padding: 8px;">
            No employees enrolled yet.
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function enrollEmployee() {
      const input = document.getElementById('empNameInput');
      const name = input.value.trim();
      if (!name) {
        alert("Please enter employee name!");
        return;
      }

      try {
        const res = await fetch(`/enroll?name=${encodeURIComponent(name)}`, { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
          input.value = "";
          loadEmployees();
        }
      } catch (err) {
        alert("Enrollment failed: " + err);
      }
    }

    async function loadEmployees() {
      try {
        const res = await fetch('/employees');
        const list = await res.json();
        const container = document.getElementById('employeeList');
        document.getElementById('enrolledCount').innerText = list.length;

        if (list.length === 0) {
          container.innerHTML = '<div style="font-size: 12px; color: #64748b; text-align: center; padding: 8px;">No staff enrolled yet.</div>';
          return;
        }

        container.innerHTML = list.map(emp => `
          <div class="employee-item">
            <div class="emp-info">
              <img src="${emp.thumb}" class="emp-thumb" alt="${emp.name}" />
              <div>
                <div class="emp-name">${emp.name}</div>
                <div class="emp-time">${emp.enrolled_at}</div>
              </div>
            </div>
            <button class="btn btn-danger" style="padding: 3px 6px; font-size: 10px;" onclick="deleteEmployee('${emp.id}')">✕</button>
          </div>
        `).join('');
      } catch (e) {}
    }

    async function deleteEmployee(id) {
      if (!confirm("Delete this employee from biometric DB?")) return;
      await fetch(`/employees/${id}`, { method: 'DELETE' });
      loadEmployees();
    }

    async function updateThreshold(val) {
      document.getElementById('sliderVal').innerText = `${parseFloat(val).toFixed(2)}`;
      await fetch(`/set_threshold?val=${val}`, { method: 'POST' });
    }

    async function pollStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();

        const badge = document.getElementById('statusBadge');
        const title = document.getElementById('statusText');
        const sub = document.getElementById('statusSub');
        const liveScore = document.getElementById('livenessScore');
        const pill = document.getElementById('securityPill');

        if (!data.face_detected) {
          badge.className = "status-badge idle";
          title.innerText = "Awaiting Face...";
          sub.innerText = "Stand in front of the camera";
          liveScore.innerText = "No Face in View";
          pill.className = "security-pill live";
          pill.innerText = "Ready";
        } else if (!data.is_live) {
          // SPOOF DETECTED
          badge.className = "status-badge spoof";
          title.innerText = "⚠️ SPOOF DETECTED!";
          sub.innerText = "Access BLOCKED: Phone screen, printed photo, or fake face detected.";
          liveScore.innerText = `Fake Face (${((1.0 - data.liveness_score)*100).toFixed(1)}% Spoof Confidence)`;
          pill.className = "security-pill fake";
          pill.innerText = "BLOCKED";
        } else if (data.is_match) {
          // LIVE REAL MATCHED EMPLOYEE
          badge.className = "status-badge matched";
          title.innerText = `✅ ${data.recognized_name}`;
          sub.innerText = `Verified Live Human (Match: ${data.similarity.toFixed(2)})`;
          liveScore.innerText = `Live Person (${(data.liveness_score*100).toFixed(1)}% Real)`;
          pill.className = "security-pill live";
          pill.innerText = "LIVE HUMAN";
        } else {
          // LIVE REAL STRANGER
          badge.className = "status-badge unknown";
          title.innerText = "❌ UNKNOWN PERSON";
          sub.innerText = data.total_enrolled > 0 
            ? `Real person, but not registered (Score: ${data.similarity.toFixed(2)})`
            : "Real person detected, but no staff in database.";
          liveScore.innerText = `Live Person (${(data.liveness_score*100).toFixed(1)}% Real)`;
          pill.className = "security-pill live";
          pill.innerText = "LIVE HUMAN";
        }
      } catch (e) {}
    }

    loadEmployees();
    setInterval(pollStatus, 300);
  </script>
</body>
</html>
    """


def run_server():
    global camera
    load_enrolled_faces()
    print("\n" + "=" * 65)
    print(" REVIVE HR - BIOMETRIC ATTENDANCE STATION SERVICE")
    print("=" * 65)
    print(" [*] Connecting to camera (Index 0)...")
    camera = CameraStream()
    print(" [*] Camera active!")
    print(" [*] Attendance Station Kiosk : http://localhost:5050/station/")
    print(" [*] Biometric Monitor Debug  : http://localhost:5050/monitor")
    print("=" * 65)
    print(" [READY] Face Detection (YuNet), Anti-Spoofing (MiniFASNet), and Recognition (SFace) ACTIVE!")
    print(" [INFO] Press Ctrl+C in this terminal window to stop the server.\n")

    def open_browser():
        time.sleep(1.2)
        import webbrowser
        webbrowser.open("http://localhost:5050/station/")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=5050, log_level="info")


if __name__ == "__main__":
    run_server()
