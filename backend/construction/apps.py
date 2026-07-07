import os
import sys

from django.apps import AppConfig


class ConstructionConfig(AppConfig):
    name = "construction"

    def ready(self) -> None:
        is_runserver = "runserver" in sys.argv and os.environ.get("RUN_MAIN") == "true"
        is_launcher = os.environ.get("OBRAGEST_LAUNCHER") == "1"
        if not is_runserver and not is_launcher:
            return

        from construction.services.google_drive import (
            maybe_restore_on_startup,
            start_backup_scheduler,
        )

        try:
            maybe_restore_on_startup()
        except Exception:
            pass

        start_backup_scheduler()
