import os
import sys

from django.apps import AppConfig


class ConstructionConfig(AppConfig):
    name = "construction"

    def ready(self) -> None:
        if "runserver" not in sys.argv:
            return
        if os.environ.get("RUN_MAIN") != "true":
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
