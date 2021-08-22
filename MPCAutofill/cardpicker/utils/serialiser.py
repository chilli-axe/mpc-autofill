from django.utils import dateformat
from hurry.filesize import alternative
from hurry.filesize import size as int_size_to_string


def card_to_dict(obj):
    """
    Serialises a given Card object. Defined here because both models.py and documents.py use this function.
    """
    size = 0
    if obj.size:
        size = obj.size
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
        "size": int_size_to_string(size, system=alternative),
    }
