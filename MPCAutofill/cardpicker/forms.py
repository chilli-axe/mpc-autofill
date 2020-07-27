from django import forms


class SubmitCardListForm(forms.Form):
    card_list = forms.CharField(
        widget=forms.Textarea(attrs={'placeholder': '4x Primeval Titan\r'
                                                    '4x Summoner\'s Pact\r'
                                                    '4x Amulet of Vigor\r'
                                                    '2x Explore',
        # widget=forms.Textarea(attrs={'placeholder': '4x Bloodghast\r'
        #                                             '2x Golgari Thug\r'
        #                                             '3x Narcomoeba\r'
        #                                             '3x Merchant of the Vale',
                                     'rows': '15',
                                     'class': 'form-control',
                                     'style': 'margin-bottom: 5px;'
                                     }),
        label="",
        # label="Type your desired card order into the box below. One card per line."
        #       "<br>Unsure of what this is all about or what to do? "
        #       "Check out the <a href='/guide'>Guide</a>!",
        required=True)


class CSVUploadForm(forms.Form):
    file = forms.FileField()
