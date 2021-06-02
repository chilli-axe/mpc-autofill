from django.contrib import admin

from .models import Card, Cardback, DFCPair, Source, Token


# Register your models here.
@admin.register(Card)
class AdminCard(admin.ModelAdmin):
    list_display = ("name", "source", "dpi", "date")


@admin.register(Cardback)
class AdminCardback(admin.ModelAdmin):
    list_display = ("name", "source", "dpi", "date")


@admin.register(Token)
class AdminToken(admin.ModelAdmin):
    list_display = ("name", "source", "dpi", "date")


@admin.register(DFCPair)
class AdminDFCPair(admin.ModelAdmin):
    list_display = ("front", "back")


@admin.register(Source)
class AdminSource(admin.ModelAdmin):
    list_display = ("id", "drive_id", "contribution", "description")

    def contribution(self, obj):
        qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi = obj.count()

        return "{} images - {} cards, {} cardbacks, and {} tokens @ {} DPI on average".format(
            qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi
        )
