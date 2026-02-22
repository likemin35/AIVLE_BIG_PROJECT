FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["bash", "-lc", "exec gunicorn -b 0.0.0.0:${PORT:-8080} create_terms:app --workers=1 --threads=4 --timeout=900"]
