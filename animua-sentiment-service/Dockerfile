FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt

RUN useradd --create-home --uid 10001 appuser

COPY --chown=appuser:appuser app.py model_config.py ./
COPY --chown=appuser:appuser sentiment_model.pkl category_model.pkl ./
COPY --chown=appuser:appuser models/roberta/sentiment/ ./models/roberta/sentiment/
COPY --chown=appuser:appuser models/roberta/category/ ./models/roberta/category/

USER appuser

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
