import time
from typing import Any, Optional

from cardpicker.models import Source
from cardpicker.sources.update_database import update_database
from cardpicker.utils import log_hours_minutes_seconds_elapsed
from cardpicker.utils.search_functions import ping_elasticsearch
from django.core import management
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "You may specify one of the following drives: " + ", ".join(Source.objects.values_list("key", flat=True))

    def add_arguments(self, parser) -> None:  # type: ignore
        parser.add_argument("-d", "--drive", type=str, help="Only update a specific drive")

    def handle(self, *args: Any, **kwargs: str) -> None:
        if not ping_elasticsearch():
            raise Exception("Elasticsearch is offline!")
        # user can specify which drive should be searched - if no drive is specified, search all drives
        drive: Optional[str] = kwargs.get("drive", None)
        t0 = time.time()
        update_database(source_key=drive)
        management.call_command("search_index", "--rebuild", "-f")
        print("")
        log_hours_minutes_seconds_elapsed(t0)
