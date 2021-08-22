from django.shortcuts import render
from blog.models import Blog, BlogPost, ShowcaseBlogPost


def index(request):
    # get all blog posts and insert into context
    posts = [x.get_synopsis() for x in BlogPost.objects.all()]
    return render(request, "blog/blog.html", {"posts": posts})


def blog(request, blog):
    # get all blog posts and insert into context
    posts = [x.get_synopsis() for x in BlogPost.objects.filter(blog__url=blog)]
    return render(request, "blog/blog.html", {"blog": Blog.objects.get(url=blog), "posts": posts})


def blog_post(request, blog, blog_post):
    # todo: retrieve blog object
    post_id = blog_post.split("-")[0]
    post = ShowcaseBlogPost.objects.get(id=post_id)
    post_template = "showcase_blog_post"
    if not post:
        post = BlogPost.objects.get(id=post_id)
        post_template = "blog_post"
    return render(request, f"blog/{post_template}.html", {"post": post.get_content()})
