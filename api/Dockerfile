# Use a stable Jammy-based Playwright image
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only for efficiency)
RUN playwright install chromium

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Command to run the application using the python entrypoint
CMD ["python", "-u", "main.py"]
