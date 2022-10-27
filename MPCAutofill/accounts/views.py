from accounts.forms import SignUpForm

from django.contrib.auth import authenticate, login
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.views import generic

from cardpicker.models import Project


class SignUpView(generic.CreateView):  # type: ignore
    form_class = SignUpForm
    success_url = reverse_lazy("login")
    template_name = "registration/signup.html"

    # def post(self, request, *args, **kwargs):
    #     form = self.get_form()
    #     print("")
    #     super().post(request, *args, **kwargs)


def projects(request: HttpRequest) -> HttpResponse:
    """
    Render the projects page - show all projects in the user's account and allow them to create/update/delete them.
    """

    if request.user.is_authenticated:
        user_projects = [x.to_dict() for x in Project.objects.filter(user=request.user)]
        return render(request, "accounts/projects.html", {"projects": user_projects})
    else:
        return render(request, "registration/login.html")  # TODO
