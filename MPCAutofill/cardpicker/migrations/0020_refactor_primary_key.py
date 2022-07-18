"""
This migration refactors the primary keys for `Source`, `Card`, `Cardback`, `Token`, and `DFCPair` models to use
Django's auto-incrementing integer primary key. This migration will drop the contents of these tables!
Please use the `export_sources` management command to back up your sources (and make sure you check the contents
of this file yourself) before running this migration.
"""

import datetime as dt

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cardpicker", "0019_alter_source_drive_link"),
    ]

    operations = [
        # drop existing tables
        migrations.DeleteModel(name="Card"),
        migrations.DeleteModel(name="Cardback"),
        migrations.DeleteModel(name="Token"),
        migrations.DeleteModel(name="Source"),
        migrations.DeleteModel(name="DFCPair"),
        # recreate tables with auto-increment primary key
        migrations.CreateModel(
            name="Source",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=50, unique=True)),
                ("drive_id", models.CharField(max_length=100, unique=True)),
                ("drive_link", models.CharField(max_length=200, blank=True, null=True)),
                ("description", models.CharField(max_length=400)),
                ("order", models.IntegerField(default=0)),
            ],
            options={"ordering": ["order"]},
        ),
        *[
            # one migration for each card table
            migrations.CreateModel(
                name=table_name,
                fields=[
                    (
                        "id",
                        models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                    ),
                    ("drive_id", models.CharField(max_length=50, unique=True)),
                    ("name", models.CharField(max_length=200)),
                    ("priority", models.IntegerField(default=0)),
                    ("source", models.ForeignKey(on_delete=models.CASCADE, to="cardpicker.source")),
                    ("source_verbose", models.CharField(max_length=50)),
                    ("dpi", models.IntegerField(default=0)),
                    ("searchq", models.CharField(max_length=200)),
                    ("searchq_keyword", models.CharField(max_length=200)),
                    ("extension", models.CharField(max_length=200)),
                    ("date", models.DateTimeField(default=dt.datetime.now)),
                    ("size", models.IntegerField()),
                ],
                options={"ordering": ["-priority"], "abstract": False},
            )
            for table_name in ["Card", "Cardback", "Token"]
        ],
        migrations.CreateModel(
            name="DFCPair",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("front", models.CharField(max_length=200, unique=True)),
                ("front_searchable", models.CharField(max_length=200, unique=True)),
                ("back", models.CharField(max_length=200, unique=True)),
                ("back_searchable", models.CharField(max_length=200, unique=True)),
            ],
        ),
    ]
