from django.utils import dateformat


def card_to_dict(obj):
    """
    Serialises a given Card object. Defined here because both models.py and documents.py use this function.
    """
    return {
        "id": obj.id,
        "name": obj.name,
        "priority": obj.priority,
        "source": obj.source,
        "source_verbose": obj.source_verbose,
        "dpi": obj.dpi,
        "searchq": obj.searchq,
        "thumbpath": obj.thumbpath,
        "date": dateformat.format(obj.date, "jS F, Y"),
        "size": obj.size,
    }
