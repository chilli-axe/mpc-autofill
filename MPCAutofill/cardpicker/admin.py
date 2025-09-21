from django.contrib import admin

from .models import Card, DFCPair, Project, ProjectMember, Source, Tag


# Register your models here.
@admin.register(Tag)
class AdminTag(admin.ModelAdmin[Tag]):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Card)
class AdminCard(admin.ModelAdmin[Card]):
    list_display = ("identifier", "name", "source", "dpi", "date_created", "tags")
    search_fields = ("identifier", "name")


@admin.register(DFCPair)
class AdminDFCPair(admin.ModelAdmin[DFCPair]):
    list_display = ("front", "back")
    search_fields = ("front",)


@admin.register(Source)
class AdminSource(admin.ModelAdmin[Source]):
    list_display = ("name", "identifier", "contribution", "description")
    search_fields = ("name", "identifier")

    def contribution(self, obj: Source) -> str:
        qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi = obj.count()

        return "{} images - {} cards, {} cardbacks, and {} tokens @ {} DPI on average".format(
            qty_all, qty_cards, qty_cardbacks, qty_tokens, avgdpi
        )


@admin.register(Project)
class AdminProject(admin.ModelAdmin[Project]):
    list_display = ("key", "name", "user", "date_created", "date_modified", "cardback", "cardstock")


@admin.register(ProjectMember)
class AdminCardProjectMembership(admin.ModelAdmin[ProjectMember]):
    list_display = ("card_id", "project", "query", "slot", "face")
