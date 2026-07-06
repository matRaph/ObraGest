from django.contrib import admin
from django.urls import include, path

from construction.views import GoogleDriveCallbackView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("construction.urls")),
    path("google/callback/", GoogleDriveCallbackView.as_view(), name="google-callback"),
]
