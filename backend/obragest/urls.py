from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from construction.views import GoogleDriveCallbackView
from obragest.spa import SpaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("construction.urls")),
    path("google/callback/", GoogleDriveCallbackView.as_view(), name="google-callback"),
]

# SPA: "/" e rotas do React Router (depois da API/admin)
if settings.FRONTEND_DIST.exists():
    urlpatterns += [
        path("", SpaView.as_view(), name="spa-root"),
        re_path(
            r"^(?!api/|admin/|google/|static/).*$",
            SpaView.as_view(),
            name="spa-fallback",
        ),
    ]
