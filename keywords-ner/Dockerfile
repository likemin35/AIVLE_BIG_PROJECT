# base image
FROM python:3.9-slim

# system dependency
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# set working directory
WORKDIR /app

# copy and install requirements
COPY keywords-ner/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy source code
COPY keywords-ner/keywords.py .

# expose port
EXPOSE 8080

# run app
CMD ["sh", "-c", "gunicorn --timeout 120 -b 0.0.0.0:$PORT keywords:app"]
