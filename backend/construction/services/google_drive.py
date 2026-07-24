import io
import json
import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import NoReturn

from django.conf import settings
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from construction.models import Obra
from construction.services.backup import (
    _db_path,
    build_backup_archive,
    restore_backup_file,
)

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_FOLDER_NAME = "ObraGest Backups"
BACKUP_MIME = "application/zip"
FOLDER_MIME = "application/vnd.google-apps.folder"
REAUTH_MESSAGE = (
    "A autorização do Google Drive expirou ou foi revogada. "
    "Reconecte sua conta Google em Configurações."
)

_scheduler_thread: threading.Thread | None = None
_scheduler_lock = threading.Lock()
_sync_lock = threading.Lock()


class GoogleDriveReauthRequired(RuntimeError):
    """Refresh token inválido; o usuário precisa reconectar o Google Drive."""

    def __init__(self, message: str = REAUTH_MESSAGE):
        super().__init__(message)


def _token_path() -> Path:
    return Path(settings.GOOGLE_DRIVE_TOKEN_PATH)


def _state_path() -> Path:
    return Path(settings.GOOGLE_DRIVE_STATE_PATH)


def _client_secrets_path() -> Path:
    return Path(settings.GOOGLE_OAUTH_CLIENT_SECRETS)


def _load_state() -> dict:
    path = _state_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(state: dict) -> None:
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _load_token_data() -> dict | None:
    path = _token_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _save_token_data(data: dict) -> None:
    path = _token_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _delete_token_data() -> None:
    path = _token_path()
    if path.exists():
        path.unlink()


def is_configured() -> bool:
    return _client_secrets_path().exists()


def is_connected() -> bool:
    return _load_token_data() is not None


def _pending_oauth_dir() -> Path:
    return Path(settings.GOOGLE_OAUTH_PENDING_DIR)


def _save_pending_oauth(state: str, code_verifier: str) -> None:
    pending_dir = _pending_oauth_dir()
    pending_dir.mkdir(parents=True, exist_ok=True)
    path = pending_dir / f"{state}.json"
    path.write_text(
        json.dumps(
            {
                "code_verifier": code_verifier,
                "created_at": datetime.now().isoformat(),
            }
        ),
        encoding="utf-8",
    )


def _pop_pending_oauth(state: str) -> str | None:
    _cleanup_expired_pending()
    path = _pending_oauth_dir() / f"{state}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("code_verifier")
    except (json.JSONDecodeError, OSError):
        return None
    finally:
        path.unlink(missing_ok=True)


def _cleanup_expired_pending(max_age_seconds: int = 600) -> None:
    pending_dir = _pending_oauth_dir()
    if not pending_dir.exists():
        return
    now = datetime.now().timestamp()
    for path in pending_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            created = datetime.fromisoformat(data["created_at"]).timestamp()
            if now - created > max_age_seconds:
                path.unlink(missing_ok=True)
        except (json.JSONDecodeError, OSError, KeyError, ValueError):
            path.unlink(missing_ok=True)


def _build_flow() -> Flow:
    secrets = _client_secrets_path()
    if not secrets.exists():
        raise FileNotFoundError(
            "Credenciais do Google não encontradas. "
            f"Coloque o arquivo JSON em {secrets}."
        )
    flow = Flow.from_client_secrets_file(str(secrets), scopes=SCOPES)
    flow.redirect_uri = settings.GOOGLE_DRIVE_REDIRECT_URI
    return flow


def get_auth_url() -> str:
    flow = _build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    if not flow.code_verifier:
        raise RuntimeError("PKCE code_verifier não gerado pelo fluxo OAuth.")
    _save_pending_oauth(state, flow.code_verifier)
    return auth_url


def handle_oauth_callback(code: str, state: str | None) -> dict:
    if not state:
        raise ValueError("Parâmetro state ausente no callback OAuth.")

    code_verifier = _pop_pending_oauth(state)
    if not code_verifier:
        raise ValueError("Sessão OAuth expirada ou inválida. Tente conectar novamente.")

    flow = _build_flow()
    flow.fetch_token(code=code, code_verifier=code_verifier)
    creds = flow.credentials

    service = build("drive", "v3", credentials=creds)
    about = service.about().get(fields="user(emailAddress)").execute()
    email = about.get("user", {}).get("emailAddress", "")

    folder_id = _get_or_create_folder(service)

    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or SCOPES),
        "email": email,
        "folder_id": folder_id,
        "connected_at": datetime.now().isoformat(),
    }
    _save_token_data(token_data)
    return {"email": email}


def disconnect() -> None:
    data = _load_token_data()
    token = data.get("token") if data else None
    if token:
        try:
            import urllib.parse
            import urllib.request

            params = urllib.parse.urlencode({"token": token})
            urllib.request.urlopen(
                f"https://oauth2.googleapis.com/revoke?{params}", timeout=10
            )
        except Exception:
            logger.warning("Não foi possível revogar o token no Google.", exc_info=True)
    _delete_token_data()


def _invalidate_credentials(reason: Exception | None = None) -> NoReturn:
    _delete_token_data()
    if reason is not None:
        logger.warning("Token Google Drive inválido; removido. Motivo: %s", reason)
    raise GoogleDriveReauthRequired() from reason


def _get_credentials() -> Credentials | None:
    data = _load_token_data()
    if not data:
        return None

    creds = Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri"),
        client_id=data.get("client_id"),
        client_secret=data.get("client_secret"),
        scopes=data.get("scopes", SCOPES),
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            data["token"] = creds.token
            _save_token_data(data)
        except RefreshError as exc:
            _invalidate_credentials(exc)
    elif creds.expired:
        _invalidate_credentials()

    return creds


def _get_service():
    creds = _get_credentials()
    if not creds:
        raise GoogleDriveReauthRequired("Google Drive não conectado.")
    return build("drive", "v3", credentials=creds)


def _ensure_file_in_folder(service, file_id: str, folder_id: str) -> None:
    meta = service.files().get(fileId=file_id, fields="id, parents").execute()
    parents = meta.get("parents") or []
    if folder_id in parents and len(parents) == 1:
        return

    update_kwargs: dict = {
        "fileId": file_id,
        "addParents": folder_id,
        "fields": "id, parents",
    }
    to_remove = [parent for parent in parents if parent != folder_id]
    if to_remove:
        update_kwargs["removeParents"] = ",".join(to_remove)
    elif folder_id not in parents:
        update_kwargs["removeParents"] = "root"

    service.files().update(**update_kwargs).execute()
    logger.info("Backup %s movido para a pasta %s.", file_id, DRIVE_FOLDER_NAME)


def _relocate_loose_backups(service, folder_id: str) -> int:
    query = (
        "'root' in parents and "
        "name contains 'obragest_backup_' and "
        "mimeType != 'application/vnd.google-apps.folder' and "
        "trashed = false"
    )
    results = (
        service.files()
        .list(
            q=query,
            spaces="drive",
            fields="files(id, name)",
            pageSize=100,
        )
        .execute()
    )
    moved = 0
    for item in results.get("files", []):
        try:
            _ensure_file_in_folder(service, item["id"], folder_id)
            moved += 1
            logger.info("Backup solto realocado: %s", item["name"])
        except Exception:
            logger.warning(
                "Não foi possível mover backup solto: %s",
                item["name"],
                exc_info=True,
            )
    return moved


def _get_or_create_folder(service) -> str:
    data = _load_token_data() or {}
    folder_id = data.get("folder_id")
    if folder_id:
        try:
            service.files().get(fileId=folder_id, fields="id,trashed").execute()
            return folder_id
        except Exception:
            pass

    query = (
        f"name = '{DRIVE_FOLDER_NAME}' and "
        f"mimeType = '{FOLDER_MIME}' and trashed = false"
    )
    results = (
        service.files()
        .list(q=query, spaces="drive", fields="files(id)", pageSize=1)
        .execute()
    )
    files = results.get("files", [])
    if files:
        folder_id = files[0]["id"]
    else:
        metadata = {"name": DRIVE_FOLDER_NAME, "mimeType": FOLDER_MIME}
        folder = service.files().create(body=metadata, fields="id").execute()
        folder_id = folder["id"]

    data["folder_id"] = folder_id
    if data.get("refresh_token"):
        _save_token_data(data)
    _relocate_loose_backups(service, folder_id)
    return folder_id


def _db_fingerprint() -> tuple[float, int]:
    db = _db_path()
    if not db.exists():
        return 0.0, 0
    stat = db.stat()
    return stat.st_mtime, stat.st_size


def _needs_backup() -> bool:
    state = _load_state()
    mtime, size = _db_fingerprint()
    if mtime == 0 and size == 0:
        return False
    return state.get("last_db_mtime") != mtime or state.get("last_db_size") != size


def list_drive_backups() -> list[dict]:
    service = _get_service()
    folder_id = _get_or_create_folder(service)
    query = (
        f"'{folder_id}' in parents and "
        f"name contains 'obragest_backup_' and trashed = false"
    )
    results = (
        service.files()
        .list(
            q=query,
            spaces="drive",
            fields="files(id, name, size, createdTime, modifiedTime)",
            orderBy="createdTime desc",
            pageSize=50,
        )
        .execute()
    )
    backups = []
    for item in results.get("files", []):
        backups.append(
            {
                "id": item["id"],
                "nome": item["name"],
                "tamanho": int(item.get("size", 0)),
                "criado_em": item.get("createdTime", item.get("modifiedTime", "")),
            }
        )
    return backups


def _prune_old_backups(service, folder_id: str) -> None:
    max_backups = settings.GOOGLE_DRIVE_MAX_BACKUPS
    query = (
        f"'{folder_id}' in parents and "
        f"name contains 'obragest_backup_' and trashed = false"
    )
    results = (
        service.files()
        .list(
            q=query,
            spaces="drive",
            fields="files(id, name, createdTime)",
            orderBy="createdTime desc",
            pageSize=100,
        )
        .execute()
    )
    files = results.get("files", [])
    for item in files[max_backups:]:
        service.files().delete(fileId=item["id"]).execute()
        logger.info("Backup antigo removido do Drive: %s", item["name"])


def upload_backup(force: bool = False) -> dict | None:
    if not is_connected():
        return None

    if not force and not _needs_backup():
        return None

    with _sync_lock:
        if not force and not _needs_backup():
            return None

        filename, buffer = build_backup_archive()
        service = _get_service()
        folder_id = _get_or_create_folder(service)

        metadata = {"name": filename, "parents": [folder_id]}
        media = MediaIoBaseUpload(buffer, mimetype=BACKUP_MIME, resumable=False)
        uploaded = (
            service.files()
            .create(body=metadata, media_body=media, fields="id, name, size, createdTime, parents")
            .execute()
        )
        _ensure_file_in_folder(service, uploaded["id"], folder_id)

        mtime, size = _db_fingerprint()
        state = _load_state()
        state.update(
            {
                "last_backup_at": datetime.now().isoformat(),
                "last_backup_id": uploaded["id"],
                "last_backup_name": uploaded["name"],
                "last_db_mtime": mtime,
                "last_db_size": size,
            }
        )
        _save_state(state)
        _prune_old_backups(service, folder_id)

        return {
            "id": uploaded["id"],
            "nome": uploaded["name"],
            "tamanho": int(uploaded.get("size", 0)),
            "criado_em": uploaded.get("createdTime", ""),
        }


def restore_from_drive(file_id: str) -> None:
    service = _get_service()
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    from googleapiclient.http import MediaIoBaseDownload

    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)
    restore_backup_file(buffer)

    mtime, size = _db_fingerprint()
    state = _load_state()
    state.update(
        {
            "last_restore_at": datetime.now().isoformat(),
            "last_db_mtime": mtime,
            "last_db_size": size,
        }
    )
    _save_state(state)


def maybe_restore_on_startup() -> bool:
    if not is_connected():
        return False

    db = _db_path()
    if db.exists() and db.stat().st_size > 0:
        try:
            if Obra.objects.exists():
                return False
        except Exception:
            pass

    backups = list_drive_backups()
    if not backups:
        return False

    restore_from_drive(backups[0]["id"])
    logger.info("Banco restaurado automaticamente do Google Drive: %s", backups[0]["nome"])
    return True


def get_status() -> dict:
    token = _load_token_data()
    state = _load_state()
    secrets_path = _client_secrets_path()
    status = {
        "configured": is_configured(),
        "connected": token is not None,
        "email": token.get("email") if token else None,
        "credentials_path": str(secrets_path.resolve()),
        "last_backup_at": state.get("last_backup_at"),
        "last_restore_at": state.get("last_restore_at"),
        "last_backup_name": state.get("last_backup_name"),
        "interval_minutes": settings.GOOGLE_DRIVE_BACKUP_INTERVAL_MINUTES,
        "max_backups": settings.GOOGLE_DRIVE_MAX_BACKUPS,
        "needs_reauth": False,
    }
    if token:
        try:
            status["backups"] = list_drive_backups()
        except GoogleDriveReauthRequired as exc:
            status["connected"] = False
            status["email"] = None
            status["backups"] = []
            status["needs_reauth"] = True
            status["error"] = str(exc)
        except Exception as exc:
            status["backups"] = []
            status["error"] = str(exc)
    else:
        status["backups"] = []
    return status


def _scheduler_loop() -> None:
    interval = settings.GOOGLE_DRIVE_BACKUP_INTERVAL_MINUTES * 60
    time.sleep(10)
    while True:
        try:
            if is_connected():
                upload_backup()
        except GoogleDriveReauthRequired:
            logger.warning(
                "Backup automático pausado: autorização do Google Drive expirada."
            )
        except Exception:
            logger.exception("Erro no backup automático do Google Drive.")
        time.sleep(interval)


def start_backup_scheduler() -> None:
    global _scheduler_thread
    with _scheduler_lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return
        _scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            name="google-drive-backup",
            daemon=True,
        )
        _scheduler_thread.start()
