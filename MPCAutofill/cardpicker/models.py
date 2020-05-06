from django.db import models


# Create your models here.
class Card(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=200)
    priority = models.IntegerField(default=0)
    source = models.CharField(max_length=50)

    def __str__(self):
        return "[{}] {}: {}".format(self.source, self.name[0:-4], self.id)
