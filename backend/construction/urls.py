from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BackupView,
    CategoriaViewSet,
    DashboardView,
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
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("backup/", BackupView.as_view(), name="backup"),
    path("backup/restore/", RestoreBackupView.as_view(), name="backup-restore"),
]
