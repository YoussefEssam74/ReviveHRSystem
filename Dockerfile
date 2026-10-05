FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY biometric_test/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy biometric service code and ONNX models
COPY biometric_test/ /app

# Render uses port 10000 by default (injected via $PORT)
EXPOSE 10000

CMD ["python", "app.py"]
