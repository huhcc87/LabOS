# ════════════════════════════════════════════════════════════════════════
# LabOS v3 — Backend Docker image (used by Fly.io, Cloud Run, Render, etc.)
# ════════════════════════════════════════════════════════════════════════
FROM python:3.11-slim

# System deps needed for psycopg, cryptography, qrcode, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python deps first (better Docker layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "psycopg[binary]==3.1.18"

# Copy app source
COPY . .

# Create uploads dir (file uploads default location; can override with UPLOAD_DIR env)
RUN mkdir -p /app/uploads

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Use uvicorn directly. Workers=1 keeps memory low (Fly free tier).
# Bump to 2-4 if you scale up.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
