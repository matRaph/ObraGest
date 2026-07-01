import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import connection

from construction.models import Categoria, Obra, Operacao


def _db_path() -> Path:
    return Path(settings.DATABASES["default"]["NAME"])


def _manifest() -> dict:
    return {
        "version": "1.0",
        "timestamp": datetime.now().isoformat(),
        "counts": {
            "obras": Obra.objects.count(),
            "categorias": Categoria.objects.count(),
            "operacoes": Operacao.objects.count(),
        },
    }


def create_backup(destino: str | None = None) -> Path:
    db = _db_path()
    if not db.exists():
        raise FileNotFoundError("Banco de dados não encontrado.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(destino) if destino else settings.BACKUP_DIR
    backup_dir.mkdir(parents=True, exist_ok=True)
    zip_path = backup_dir / f"obragest_backup_{timestamp}.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(db, arcname="db.sqlite3")
        zf.writestr("manifest.json", json.dumps(_manifest(), indent=2))

    return zip_path


def list_backups() -> list[dict]:
    backups = []
    for path in sorted(settings.BACKUP_DIR.glob("obragest_backup_*.zip"), reverse=True):
        backups.append(
            {
                "nome": path.name,
                "path": str(path),
                "tamanho": path.stat().st_size,
                "criado_em": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            }
        )
    return backups


def restore_backup(backup_path: str) -> None:
    path = Path(backup_path)
    if not path.exists():
        raise FileNotFoundError(f"Backup não encontrado: {backup_path}")

    with zipfile.ZipFile(path, "r") as zf:
        if "db.sqlite3" not in zf.namelist():
            raise ValueError("Backup inválido: db.sqlite3 não encontrado.")
        if "manifest.json" not in zf.namelist():
            raise ValueError("Backup inválido: manifest.json não encontrado.")

        manifest = json.loads(zf.read("manifest.json"))
        if "version" not in manifest:
            raise ValueError("Backup inválido: manifest corrompido.")

        connection.close()
        db = _db_path()
        temp_db = db.with_suffix(".sqlite3.restore")
        with zf.open("db.sqlite3") as src, open(temp_db, "wb") as dst:
            shutil.copyfileobj(src, dst)
        shutil.move(temp_db, db)
