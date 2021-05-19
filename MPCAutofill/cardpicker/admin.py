from django.contrib import admin
from .models import Card, Cardback, Token, Source, DFCPair

# Register your models here.
admin.site.register(Card)
admin.site.register(Cardback)
admin.site.register(Token)
admin.site.register(Source)
admin.site.register(DFCPair)
