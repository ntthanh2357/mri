# ==============================================================================
# NeuroScan AI - FastAPI AI Inference Service
# Multimodal AI Consensus System (MAICS) Dockerfile
# Base: Python 3.10 Slim with OpenCV headless support
# ==============================================================================

FROM python:3.10-slim

WORKDIR /app

# Install essential system libraries for OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements and install
COPY requirements.txt* ./

# Install python dependencies with pip cache disabled for minimal image size
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi>=0.110.0 \
    "uvicorn[standard]>=0.28.0" \
    pydantic>=2.6.0 \
    python-multipart>=0.0.9 \
    numpy>=1.24.3 \
    pillow>=10.2.0 \
    opencv-python-headless>=4.9.0 \
    ultralytics>=8.1.0 \
    tensorflow-cpu>=2.15.0 \
    google-genai>=0.1.1 \
    python-dotenv>=1.0.1

# Create persistent data directory for SQLite audit logs
RUN mkdir -p /app/data

# Copy application source code
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DOCKER_CONTAINER=1
ENV AUDIT_DB_PATH=/app/data/audit_logs.db
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/docs || exit 1

# Launch FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
