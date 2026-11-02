FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .

ENV WHISPER_MODEL=base.en
ENV WHISPER_COMPUTE_TYPE=int8
ENV WHISPER_MODEL_DIR=/models
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
