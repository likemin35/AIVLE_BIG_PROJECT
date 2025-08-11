# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Download SpaCy model
RUN python -m spacy download en_core_web_sm

# Copy the content of the local src directory to the working directory
COPY . .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variable
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/the-method-467402-k4-3b6511ed1f9e.json

# Run main.py when the container launches
# Use Gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]
