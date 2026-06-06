# ════════════════════════════════════════════════════════════════════════
# LabOS v3 — Backend Docker image (used by Fly.io, Cloud Run, Render, etc.)
# ════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim

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

# Create uploads dir and non-root user
RUN mkdir -p /app/uploads \
    && addgroup --gid 1000 appuser \
    && adduser --disabled-password --uid 1000 --ingroup appuser appuser \
    && chown -R appuser:appuser /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

USER appuser

# Run migrations then start uvicorn. Workers=1 keeps memory low (Fly free tier).
# Bump to 2-4 when scaling up; each worker uses ~200MB RAM.
CMD ["sh", "-c", "python -m alembic upgrade head 2>/dev/null; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
