from django import forms


class InputText(forms.Form):
    card_list = forms.CharField(
        widget=forms.Textarea(
            attrs={
                "placeholder": "4x Rite of Flame\n"
                "4x Brainstorm\n"
                "3x Mox Opal\n"
                "1x Empty the Warrens\n\n"
                "6x t:Goblin",
                "rows": "12",
                "class": "form-control",
                "style": "margin-bottom: 5px; width: 100%; height: 100%; background-color: #cfcfcf;",
            }
        ),
        label="",
        required=True,
    )


class InputCSV(forms.Form):
    file = forms.FileField()


class InputXML(forms.Form):
    file = forms.FileField()


class InputLink(forms.Form):
    list_url = forms.CharField(
        widget=forms.TextInput(
            attrs={
                "id": "list_url",
                "placeholder": "Card list URL",
                "class": "form-control",
            }
        ),
        label="",
        required=True,
    )
