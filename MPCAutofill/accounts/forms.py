from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User


class SignUpForm(UserCreationForm):
    # def __init__(self, request, *args, **kwargs):
    #     super().__init__(*args, **kwargs)
    #     self.request = request

    email = forms.EmailField(max_length=200, help_text="Required.")

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")

    # def save(self, commit=True):
    #     user = super().save(commit=commit)
    #     if commit:
    #         auth_user = authenticate(
    #             username=self.cleaned_data['username'],
    #             password=self.cleaned_data['password1']
    #         )
    #         login(self.request, auth_user)
    #
    #     return user
