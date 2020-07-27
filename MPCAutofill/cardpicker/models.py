from django.db import models


# Create your models here.
class Card(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=200)
    priority = models.IntegerField(default=0)
    source = models.CharField(max_length=50)
    dpi = models.IntegerField(default=0)
    searchq = models.CharField(max_length=200)
    thumbpath = models.CharField(max_length=200)

    def __str__(self):
        return "[{}] {}: {}, SQ: {}".format(self.source, self.name, self.id, self.searchq)

    def to_dict(self):
        return {"id": self.id,
                "name": self.name,
                "priority": self.priority,
                "source": self.source,
                "dpi": self.dpi,
                "thumbpath": self.thumbpath}


class Source(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    quantity = models.IntegerField(default=0)
    username = models.CharField(max_length=50)
    reddit = models.CharField(max_length=100)
    drivelink = models.CharField(max_length=200)
    description = models.CharField(max_length=400)

    def __str__(self):
        return "{}: {} {}".format(self.id, str(self.quantity), self.description)
