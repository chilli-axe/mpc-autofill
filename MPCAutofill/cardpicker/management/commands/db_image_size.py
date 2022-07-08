from cardpicker.models import Card, Cardback, Token
from django.core.management.base import BaseCommand
from django.db.models import Sum


class Command(BaseCommand):
    help = "Returns the total size of all images in the database"

    def handle(self, *args, **kwargs) -> None:
        # store as GB
        card_size = round(Card.objects.aggregate(Sum("size"))["size__sum"] / 1_000_000_000)
        cardback_size = round(Cardback.objects.aggregate(Sum("size"))["size__sum"] / 1_000_000_000)
        token_size = round(Token.objects.aggregate(Sum("size"))["size__sum"] / 1_000_000_000)
        print(
            f"Total size: {(card_size + cardback_size + token_size)/1000} TB - "
            f"cardbacks: {card_size} GB, "
            f"tokens: {cardback_size} GB, "
            f"tokens: {token_size} GB"
        )
