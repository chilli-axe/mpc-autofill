from django.db import migrations


def insert_searchq_keyword(apps, schema_editor) -> None:  # type: ignore  # TODO: type this properly
    for model_name in ["Card", "Cardback", "Token"]:
        model = apps.get_model("cardpicker", model_name)
        for card in model.objects.all():
            card.searchq_keyword = card.searchq
            card.save()


class Migration(migrations.Migration):

    dependencies = [
        ("cardpicker", "0015_auto_20210614_2157"),
    ]

    operations = [
        migrations.RunPython(insert_searchq_keyword),
    ]
