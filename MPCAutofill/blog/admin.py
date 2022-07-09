from blog.models import Blog, BlogPost, ShowcaseBlogPost
from django.contrib import admin

# Register your models here.
admin.site.register(Blog)
admin.site.register(BlogPost)


@admin.register(ShowcaseBlogPost)
class ShowcaseBlogPostAdmin(admin.ModelAdmin[ShowcaseBlogPost]):
    raw_id_fields = ("cards",)
