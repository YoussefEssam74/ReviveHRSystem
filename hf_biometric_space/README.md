---
title: Revive HR Biometrics
emoji: 🛡️
colorFrom: green
colorTo: emerald
sdk: docker
app_port: 7860
pinned: false
---

# Revive HR Biometric Service

Cloud inference microservice for the **Revive HR Attendance Station (Face-ID Kiosk)**.

## Architecture & Models
- **YuNet Face Detection**: High-speed ONNX face detector with 5-point facial landmarks (`face_detection_yunet.onnx`).
- **Silent-Face Anti-Spoofing**: Dual PyTorch MiniFASNet models (V1SE + V2) detecting 2D printed photos, digital screen replays, and cutouts.
- **SFace Recognition**: 128-dimensional deep metric learning embeddings for 1-to-N cosine similarity matching (`face_recognition_sface.onnx`).
- **Client-to-Cloud Streaming**: Processes browser-captured webcam frames (`POST /process_frame`) so users can test on any client device without server-attached hardware.

## Endpoints
- `GET /` — Service dashboard
- `GET /ping` — Liveness healthcheck
- `GET /status` — Model telemetry, thresholds, and enrolled face count
- `POST /process_frame` — Process base64 JPEG from client webcam, run anti-spoofing and SFace 1-to-N identification
- `POST /enroll_frame` — Enroll a new employee face with anti-spoofing verification
- `GET /employees` — List enrolled employees
- `DELETE /employees/{id}` — Delete employee face template
