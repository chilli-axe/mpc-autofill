from typing import Any

from django import template

register = template.Library()


@register.filter
def dict_get(dictionary: dict[str, Any], key: str) -> Any:
    return dictionary.get(key)
