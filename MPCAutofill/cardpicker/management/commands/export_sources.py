from typing import Any

from cardpicker.models import Source
from django.core.management.base import BaseCommand


def export_sources_csv() -> None:
    with open("exported_drives.csv", "w") as csvfile:
        sources = Source.objects.all()
        csvfile.write(
            "\n".join(
                [
                    "key,drive_id,drive_public,description",
                    *[
                        f"{source.id},{source.drive_id},{'false' if source.drive_link is None else ''},\"{source.description}\""
                        for source in sources
                    ],
                ]
            )
        )


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "Synchronises Google Drives from database to exported_drives.csv (in root project directory)."

    def handle(self, *args: Any, **kwargs: dict[str, Any]) -> None:
        if Source.objects.count() > 0:
            export_sources_csv()
            print(f"{Source.objects.count()} source/s exported from database to CSV.")
        else:
            print("No sources exported to CSV because none were found.")
