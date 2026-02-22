FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY keywords.py .

EXPOSE 8080

CMD ["gunicorn", "--timeout", "120", "-b", "0.0.0.0:8080", "keywords:app"]
