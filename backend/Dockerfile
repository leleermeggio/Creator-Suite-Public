# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps for asyncpg, ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app/backend/

EXPOSE 8000

# Run migrations then start the API
CMD ["sh", "-c", "python -m alembic -c /app/backend/alembic.ini upgrade head && uvicorn backend.main:create_app --host 0.0.0.0 --port 8000 --factory"]
