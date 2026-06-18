# VOXFORGE — one-command run via Docker
#
#   docker build -t voxforge .
#   docker run --rm -p 7860:7860 voxforge
#   open http://localhost:7860
#
FROM python:3.11-slim

# Audio + scientific stack needs a few system libs
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gradio>=6.0

COPY voxforge ./voxforge
COPY app.py ./app.py
COPY README.md pyproject.toml ./

ENV VOXFORGE_HOST=0.0.0.0
ENV VOXFORGE_PORT=7860
ENV VOXFORGE_SHARE=0
EXPOSE 7860

CMD ["python", "app.py"]
