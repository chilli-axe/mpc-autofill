from django.db import models
import string
from datetime import datetime
from markdown import markdown

# Create your models here.


class Blog(models.Model):
    name = models.CharField(max_length=20, unique=True)
    url = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.name} (url /{self.url})"

    def to_dict(self):
        return {
            "name": self.name,
            "url": self.url,
        }


class BlogPost(models.Model):
    name = models.CharField(max_length=40)
    date_created = models.DateTimeField(default=datetime.now)
    synopsis = models.TextField()
    contents = models.TextField()
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE)

    def __str__(self):
        return f"\"{self.name}\", created on {self.date_created}"

    def get_url(self) -> str:
        name_flattened = self.name.lower().translate(str.maketrans("", "", string.punctuation)).replace(" ", "-")
        # trim length if long
        # name_length = 10
        # name_shortened = name_flattened[0:name_length] if len(name_flattened) > name_length else name_flattened
        return f"{self.pk}-{name_flattened}"  # {self.blog.url}/

    def get_content(self):
        return {
            "name": self.name,
            "date_created": self.date_created,
            "contents": markdown(self.contents),
            "blog": self.blog.to_dict(),
            "url": self.get_url(),
        }

    def get_synopsis(self):
        return {
            "name": self.name,
            "date_created": self.date_created,
            "synopsis": markdown(self.synopsis),
            "blog": self.blog.name,
            "url": self.get_url(),
        }

    class Meta:
        ordering = ["-date_created"]


class ShowcaseBlogPost(BlogPost):
    cards = models.ManyToManyField('cardpicker.Card')

    def get_content(self):
        return {
            "name": self.name,
            "date_created": self.date_created,
            "contents": markdown(self.contents),
            "blog": self.blog.to_dict(),
            "url": self.get_url(),
            "cards": [x.to_dict() for x in self.cards.all()],
        }

