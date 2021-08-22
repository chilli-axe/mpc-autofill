from django.urls import path, re_path

from . import views

urlpatterns = [
    path("", views.index, name="blog-index"),
    path("<blog>/", views.blog, name="blog"),
    path("<blog>/<blog_post>/", views.blog_post, name="blog-post"),
]
