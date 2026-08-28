FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /usr/src/app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser
RUN playwright install chromium

COPY . .

# Alibaba Cloud Function Compute 3.0 custom runtime port
EXPOSE 9000

CMD ["python", "handler.py"]
