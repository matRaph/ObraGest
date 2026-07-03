from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BackupDownloadView,
    BackupView,
    CategoriaViewSet,
    DashboardView,
    HealthView,
    ObraViewSet,
    OperacaoViewSet,
    RestoreBackupView,
)

router = DefaultRouter()
router.register("obras", ObraViewSet, basename="obra")
router.register("operacoes", OperacaoViewSet, basename="operacao")
router.register("categorias", CategoriaViewSet, basename="categoria")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("backup/", BackupView.as_view(), name="backup"),
    path("backup/download/", BackupDownloadView.as_view(), name="backup-download"),
    path("backup/restore/", RestoreBackupView.as_view(), name="backup-restore"),
]
