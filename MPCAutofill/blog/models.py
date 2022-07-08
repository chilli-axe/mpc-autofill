import string
from datetime import datetime

from cardpicker.models import Card
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import dateformat
from markdown import markdown

datestring = "jS F, Y"


class Blog(models.Model):
    name = models.CharField(max_length=20, unique=True)
    url = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.name} (url /{self.url})"

    def to_dict(self):
        return {
            "name": self.name,
            "url": f"/blog/{self.url}",
        }

    def to_dict_with_posts(self, num_posts=0):
        posts = [x.get_synopsis() for x in BlogPost.objects.filter(blog__pk=self.pk)]
        if num_posts > 0:
            posts = posts[0:num_posts]
        d = self.to_dict()
        d["posts"] = posts
        return d


class BlogPost(models.Model):
    name = models.CharField(max_length=40)
    date_created = models.DateTimeField(default=datetime.now)
    synopsis = models.TextField(max_length=140)  # truncated for Google page description
    contents = models.TextField()
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE)

    def __str__(self):
        return f'"{self.name}", created on {self.date_created}'

    def get_url(self) -> str:
        name_flattened = self.name.lower().translate(str.maketrans("", "", string.punctuation)).replace(" ", "-")
        post_url = f"/blog/{self.blog.url}/{self.pk}-{name_flattened}"
        return post_url

    def get_content(self):
        return {
            "name": self.name,
            "date_created": dateformat.format(self.date_created, datestring),
            "synopsis": self.synopsis,
            "contents": markdown(self.contents),
            "blog": self.blog.to_dict(),
            "url": self.get_url(),
        }

    def get_synopsis(self):
        # i thought it'd be neat if each synopsis's border colour changed
        borders = ["primary", "success", "warning", "info", "light"]
        return {
            "name": self.name,
            "date_created": dateformat.format(self.date_created, datestring),
            "synopsis": markdown(self.synopsis),
            "blog": self.blog.name,
            "url": self.get_url(),
            "border": borders[self.pk % len(borders)],
        }

    class Meta:
        ordering = ["-date_created"]


class ShowcaseBlogPost(BlogPost):
    """
    TODO: many to many fields are problematic with how the database updates (deletes all rows and creates new rows)
    re-evaluate this later and see if it's possible to use many to many - for now, I'm storing google drive IDs in
    plaintext comma-separated and retrieving the objects from those IDs
    It's also probably possible to set up the database crawler to account for this
    """

    cards = models.ManyToManyField("cardpicker.Card", blank=True)
    card_ids = models.CharField(max_length=800, blank=True)

    def get_content(self):
        cards = []
        try:
            card_ids = self.card_ids.split(",")
            cards = [x.to_dict() for x in Card.objects.filter(pk__in=card_ids)]
        except (ObjectDoesNotExist, AttributeError):
            pass
        return {
            "name": self.name,
            "date_created": dateformat.format(self.date_created, datestring),
            "contents": markdown(self.contents),
            "blog": self.blog.to_dict(),
            "url": self.get_url(),
            "cards": cards,
        }
