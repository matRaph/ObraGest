import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = Path(os.environ.get("OBRA_GEST_DATA_DIR", BASE_DIR))
DATA_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-uq0xn!44yho%jq+io(4)#1h7(tl37$kqw@v6ubeerc*b9!eepi",
)

DEBUG = os.environ.get("DEBUG", "true").lower() == "true"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "construction",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "obragest.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "obragest.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Quando empacotado com PyInstaller, o frontend/dist fica dentro do bundle
if getattr(sys, "frozen", False):
    FRONTEND_DIST = Path(sys._MEIPASS) / "frontend" / "dist"
else:
    FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    STATICFILES_DIRS = [FRONTEND_DIST]
    WHITENOISE_ROOT = FRONTEND_DIST
    # Serve index.html em "/" (necessário para o SPA)
    WHITENOISE_INDEX_FILE = True
else:
    WHITENOISE_ROOT = None

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "obragest.pagination.FlexiblePageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    # No exe (DEBUG=false) evita TemplateDoesNotExist do browsable API
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ]
    + (
        ["rest_framework.renderers.BrowsableAPIRenderer"]
        if DEBUG
        else []
    ),
}

BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _default_google_oauth_secrets() -> Path:
    """No .exe, usa o JSON embutido no bundle; senão, pasta de dados."""
    if getattr(sys, "frozen", False):
        bundled = Path(sys._MEIPASS) / "google_client_secret.json"
        if bundled.is_file():
            return bundled
    return DATA_DIR / "google_client_secret.json"


GOOGLE_OAUTH_CLIENT_SECRETS = Path(
    os.environ.get("GOOGLE_OAUTH_CLIENT_SECRETS", str(_default_google_oauth_secrets()))
)
GOOGLE_DRIVE_TOKEN_PATH = DATA_DIR / "google_drive_token.json"
GOOGLE_DRIVE_STATE_PATH = DATA_DIR / "google_drive_state.json"
GOOGLE_DRIVE_REDIRECT_URI = os.environ.get(
    "GOOGLE_DRIVE_REDIRECT_URI",
    "http://localhost:8080/google/callback/",
)
GOOGLE_DRIVE_BACKUP_INTERVAL_MINUTES = int(
    os.environ.get("GOOGLE_DRIVE_BACKUP_INTERVAL_MINUTES", "30")
)
GOOGLE_DRIVE_MAX_BACKUPS = int(os.environ.get("GOOGLE_DRIVE_MAX_BACKUPS", "20"))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
GOOGLE_OAUTH_PENDING_DIR = DATA_DIR / "oauth_pending"
GOOGLE_OAUTH_PENDING_DIR.mkdir(parents=True, exist_ok=True)

# OAuth local / hosts (http://obragest.com.br) exige transporte inseguro no oauthlib
if DEBUG or os.environ.get("OBRAGEST_LAUNCHER") == "1":
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
