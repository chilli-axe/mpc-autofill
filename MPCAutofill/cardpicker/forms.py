from django import forms


class SubmitCardListForm(forms.Form):
    card_list = forms.CharField(widget=forms.Textarea(attrs={'placeholder': '4x Bloodghast\n'
                                                             '2x Golgari Thug\n'
                                                             '3x Narcomoeba\n'
                                                             '3x Merchant of the Vale',
                                                             'rows': '16',
                                                             'class': 'form-control',
                                                             }),
                                label="Copy and paste your desired card order into the box below. One card per line."
                                      "<br>Unsure of what this is all about or what to do? "
                                      "Check out the <a href='/guide'>guide</a>!",
                                required=True)
    scryfall_priority = forms.BooleanField(widget=forms.CheckboxInput(),
                                           required=False,
                                           label="Prioritise Scryfall scans over Photoshop-rendered cards "
                                                 "(lower quality, but wider range of images)")
