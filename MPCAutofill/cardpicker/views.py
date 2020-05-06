from django.shortcuts import render
from .models import Card
from .forms import SubmitCardListForm
import transforms


# Create your views here.
def index(request):

    return render(request, 'cardpicker/index.html', {'form': SubmitCardListForm})


def guide(request):
    return render(request, 'cardpicker/guide.html')


def credits(request):
    chilli_count = Card.objects.filter(source="Chilli_Axe").count()
    bazuki_count = Card.objects.filter(source="Bazukii").count()
    nofacej_count = Card.objects.filter(source="nofacej_cardbacks").count()
    scryfall_count = Card.objects.all().count() - chilli_count - bazuki_count - nofacej_count
    context = {"chilli_count": f"{chilli_count:,d}",
               "scryfall_count": f"{scryfall_count:,d}",
               "nofacej_count": f"{nofacej_count:,d}",
               "bazuki_count": f"{bazuki_count:,d}"}
    return render(request, 'cardpicker/credits.html', context)


def review(request):

    brackets = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612]

    def process_line(input_str):
        #input_str = input_str.replace("\r", "").replace("\n", "")

        # Extract the quantity and card name from a given line of the text input
        input_str = str(" ".join([x for x in input_str.split(" ") if x]))
        if input_str.isspace() or len(input_str) == 0:
            return None, None
        num_idx = 0
        input_str = input_str.replace("//", "&")
        while True:
            if num_idx > len(input_str):
                return None, None
            try:
                int(input_str[num_idx])
                num_idx += 1
            except ValueError:
                if num_idx == 0:
                    # no number at the start of the line - assume qty 1
                    qty = 1
                    name = " ".join(input_str.split(" "))
                else:
                    # located the break between qty and name
                    try:
                        qty = int(input_str[0:num_idx + 1].lower().replace("x", ""))
                    except ValueError:
                        return None, None
                    name = " ".join(x for x in input_str[num_idx + 1:].split(" ") if x)
                return name, qty

    def search_model(lines_raw, scryfall_priority):
        card_objs = Card.objects.exclude(source__icontains="_cardback")
        cardbacks = Card.objects.filter(source__icontains="_cardback").order_by('-priority')[0:50]
        card_list = []
        priority = "-"*(not scryfall_priority) + "priority"
        for line in lines_raw.splitlines():

            (cardname, qty) = process_line(line)
            if cardname:
                if qty > brackets[-1]:
                    qty = brackets[-1]

                # determine if this is a transform card/otherwise has two faces
                tf_result = [x for x in transforms.transforms.keys() if cardname.lower() in x]
                if tf_result:
                    # stick results for card front and back in a two-long tuple
                    cardname_back = transforms.transforms[tf_result[0]]
                    results = (card_objs.filter(name__icontains=cardname).order_by(priority)[0:50],
                               card_objs.filter(name__icontains=cardname_back).order_by(priority)[0:50])

                else:
                    # stick results for card in a one-long tuple
                    results = (card_objs.filter(name__icontains=cardname).order_by(priority)[0:50],)

                for _ in range(0, qty):
                    if len(card_list) >= brackets[-1]:
                        return {"cards": card_list, "qty": brackets[-1], "bracket": brackets[-1]}
                    if results:
                        card_list.append(results)
                    else:
                        card_list.append('')

        # Figure out which bracket this order lands in
        curr_bracket = brackets[[x for x, val in enumerate(brackets) if val >= len(card_list)][0]]

        # Add the remaining number of cards to this order as blank cards
        # for _ in range(len(card_list), curr_bracket):
        #     card_list.append('')

        context = {"cards": card_list,
                   "qty": len(card_list),
                   "bracket": curr_bracket,
                   "cardbacks": cardbacks}
        return context

    if request.method == "POST":
        form = SubmitCardListForm(request.POST)
        if form.is_valid():
            print("Request is valid")
            lines_raw = form['card_list'].value()
            scryfall_priority = form['scryfall_priority'].value()
            context = search_model(lines_raw, scryfall_priority)
            return render(request, 'cardpicker/review.html', context)
        else:
            return render(request, 'cardpicker/index.html')
    else:
        return render(request, 'cardpicker/index.html')
