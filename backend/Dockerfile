FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml /app/pyproject.toml
COPY app /app/app

RUN pip install --no-cache-dir .

EXPOSE 8000
# Host comes from settings (default 127.0.0.1). Compose sets HOST=0.0.0.0
# inside the container and publishes that port on 127.0.0.1 only.
CMD ["ellensuly"]
