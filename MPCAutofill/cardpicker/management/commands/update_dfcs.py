import requests
from cardpicker.models import DFCPair
import time
import os
from to_searchable import to_searchable
from django.core.management.base import BaseCommand
from bulk_sync import bulk_sync
import json
import requests


def sync_dfcs():
    scryfall_query = "https://api.scryfall.com/cards/search?q=is:dfc%20-layout:art_series%20-layout:double_faced_token"
    response = json.loads(requests.get(scryfall_query).content)

    # maintain list of all dfcs found so far
    q_dfcpairs = []
    
    for x in response['data']:
        # retrieve front and back names for this card, then create a DFCPair for it and append to list
        front_name = x['card_faces'][0]['name']
        back_name = x['card_faces'][1]['name']
        q_dfcpairs.append(
            DFCPair(
                front=to_searchable(front_name),
                back=to_searchable(back_name)
            )
        )
    
    # synchronise the located DFCPairs to database
    t0 = time.time()
    key_fields = ('front', )
    ret = bulk_sync(
        new_models=q_dfcpairs,
        key_fields=key_fields,
        filters=None,
        db_class=DFCPair
    )

    print("Finished synchronising database with Scryfall DFCs, which took {} seconds.".format(time.time() - t0))


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "Synchronises stored double-faced card pairs with Scryfall database."

    def handle(self, *args, **kwargs):
        sync_dfcs()