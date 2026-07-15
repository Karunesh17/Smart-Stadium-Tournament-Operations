# ============================================================
# Stage 1: Builder — install dependencies into /venv
# ============================================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtualenv
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy only the requirements file first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ============================================================
# Stage 2: Runtime — minimal image, non-root user
# ============================================================
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install only runtime OS deps (libpq for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# Create non-root user
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home appuser

# Copy application source (respects .dockerignore)
COPY services/ ./services/
COPY libs/ ./libs/

# Own the files
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Health check — Docker will probe /health every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production uvicorn: 4 workers, structured JSON logs, bind all interfaces
CMD ["uvicorn", "services.gateway.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "info", \
     "--no-access-log"]
