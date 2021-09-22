import csv

from bulk_sync import bulk_sync
from django.core.management.base import BaseCommand

from cardpicker.models import Source


def read_sources_csv():
    sources = []

    # read CSV file for drive data
    with open("drives.csv", newline="") as csvfile:
        drivesreader = csv.DictReader(csvfile, delimiter=",")
        # order the sources by row number in CSV
        i = 0
        for row in drivesreader:
            sources.append(
                Source(
                    id=row["key"],
                    drive_id=row["drive_id"],
                    drive_link="https://drive.google.com/open?id=" + row["drive_id"]
                    if row["drive_public"] != "FALSE"
                    else "",
                    description=row["description"],
                    order=i,
                )
            )
            i += 1

    print("Read CSV file and found {} sources.".format(len(sources)))
    return sources


def sync_sources(sources):
    key_fields = ("id",)
    ret = bulk_sync(
        new_models=sources, key_fields=key_fields, filters=None, db_class=Source
    )


class Command(BaseCommand):
    # set up help line to print the available drive options
    help = "Synchronises Google Drives from drives.csv (in root project directory) to database."

    def handle(self, *args, **kwargs):
        sources = read_sources_csv()
        if sources:
            sync_sources(sources)
            print("All sources synchronised from CSV to database.")
        else:
            print("No sources synchronised to database because none were found.")
