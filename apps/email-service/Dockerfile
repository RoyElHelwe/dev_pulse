FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY email_api.py .

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8025

CMD ["uvicorn", "email_api:app", "--host", "0.0.0.0", "--port", "8025"]
