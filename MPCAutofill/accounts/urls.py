from accounts.views import SignUpView

from django.urls import path

urlpatterns = [
    path("signup/", SignUpView.as_view(), name="signup"),
]
