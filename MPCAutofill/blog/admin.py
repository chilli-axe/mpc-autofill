from django.contrib import admin
from blog.models import Blog, BlogPost, ShowcaseBlogPost

# Register your models here.
admin.site.register(Blog)
admin.site.register(BlogPost)


@admin.register(ShowcaseBlogPost)
class ShowcaseBlogPostAdmin(admin.ModelAdmin):
    raw_id_fields = ("cards",)
