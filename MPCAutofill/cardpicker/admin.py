from django.contrib import admin

from .models import Card, DFCPair, Source


# Register your models here.
@admin.register(Card)
class AdminCard(admin.ModelAdmin[Card]):
    list_display = ("identifier", "name", "source", "dpi", "date")


@admin.register(DFCPair)
class AdminDFCPair(admin.ModelAdmin[DFCPair]):
    list_display = ("front", "back")


@admin.register(Source)
class AdminSource(admin.ModelAdmin[Source]):
    list_display = ("name", "identifier", "contribution", "description")

    def contribution(self, obj: Source) -> str:
        qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi = obj.count()

        return "{} images - {} cards, {} cardbacks, and {} tokens @ {} DPI on average".format(
            qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi
        )
