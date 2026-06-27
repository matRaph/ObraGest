FROM python:3.13-slim

WORKDIR /app

COPY backend/requirements.txt .

RUN pip install -r requirements.txt

CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]
