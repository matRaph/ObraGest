FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir \
    "django>=6.0.6" \
    "django-cors-headers>=4.9.0" \
    "djangorestframework>=3.16.0" \
    "google-api-python-client>=2.170.0" \
    "google-auth-oauthlib>=1.2.2" \
    "python-dotenv>=1.2.2" \
    "whitenoise>=6.9.0" \
    "watchfiles>=1.0.0"

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY . .

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
