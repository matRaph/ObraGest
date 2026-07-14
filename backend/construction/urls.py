from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BackupDownloadView,
    BackupView,
    CategoriaViewSet,
    DashboardView,
    FornecedorViewSet,
    GoogleDriveAuthView,
    GoogleDriveDisconnectView,
    GoogleDriveRestoreView,
    GoogleDriveStatusView,
    GoogleDriveSyncView,
    HealthView,
    ObraViewSet,
    OperacaoViewSet,
    RestoreBackupView,
)

router = DefaultRouter()
router.register("obras", ObraViewSet, basename="obra")
router.register("operacoes", OperacaoViewSet, basename="operacao")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("fornecedores", FornecedorViewSet, basename="fornecedor")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("backup/", BackupView.as_view(), name="backup"),
    path("backup/download/", BackupDownloadView.as_view(), name="backup-download"),
    path("backup/restore/", RestoreBackupView.as_view(), name="backup-restore"),
    path("google-drive/status/", GoogleDriveStatusView.as_view(), name="google-drive-status"),
    path("google-drive/auth/", GoogleDriveAuthView.as_view(), name="google-drive-auth"),
    path("google-drive/disconnect/", GoogleDriveDisconnectView.as_view(), name="google-drive-disconnect"),
    path("google-drive/sync/", GoogleDriveSyncView.as_view(), name="google-drive-sync"),
    path("google-drive/restore/", GoogleDriveRestoreView.as_view(), name="google-drive-restore"),
]
