from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views import View


class SpaView(View):
    """Serve o index.html do frontend para rotas do React Router."""

    def get(self, request, path=""):
        dist = getattr(settings, "FRONTEND_DIST", None)
        if not dist:
            raise Http404("Frontend não encontrado.")

        dist = Path(dist)
        if path:
            candidate = dist / path
            if candidate.is_file():
                return FileResponse(candidate.open("rb"))

        index = dist / "index.html"
        if not index.is_file():
            raise Http404("index.html não encontrado.")
        return FileResponse(index.open("rb"), content_type="text/html")
