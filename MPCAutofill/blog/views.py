from blog.models import Blog, BlogPost, ShowcaseBlogPost
from django.core.exceptions import ObjectDoesNotExist
from django.http import Http404
from django.shortcuts import render


def index(request):
    blogs = [x.to_dict_with_posts(num_posts=4) for x in Blog.objects.all()]
    return render(request, "blog/all_blogs.html", {"blogs": blogs})


def blog(request, blog):
    posts = [x.get_synopsis() for x in BlogPost.objects.filter(blog__url=blog)]
    return render(request, "blog/blog.html", {"blog": Blog.objects.get(url=blog), "posts": posts})


def blog_post(request, blog, blog_post):
    post_id = blog_post.split("-")[0]
    try:
        post = ShowcaseBlogPost.objects.get(id=post_id)
        post_template = "showcase_blog_post"
    except ObjectDoesNotExist:
        try:
            post = BlogPost.objects.get(id=post_id)
            post_template = "blog_post"
        except ObjectDoesNotExist:
            raise Http404("Blog post does not exist")
    return render(request, f"blog/{post_template}.html", {"post": post.get_content()})
