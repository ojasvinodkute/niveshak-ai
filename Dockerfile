# ==========================================
# Multi-stage Dockerfile for Render Deployment
# ==========================================

# 1. Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. Production Python Backend Stage
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./

# Copy compiled frontend assets into backend/frontend_dist
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# Create data directory for cache & equity CSV
RUN mkdir -p data

ENV PORT=8000
ENV DB_PATH=/app/data/cache.db
ENV SERVE_FRONTEND=true

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
