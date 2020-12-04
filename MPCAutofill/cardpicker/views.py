from django.shortcuts import render
from .models import Card, Source
from .forms import SubmitCardListForm, CSVUploadForm
from search_functions import process_line, search_card, uploaded_file_to_csv
import os
import math


BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612]


# Create your views here.
def index(request):
    sources = Source.objects.all()
    context = {}
    for source in sources:
        if "_cardback" not in source.id:
            context[source.id] = {'username': source.username,
                                  'reddit': source.reddit,
                                  'drivelink': source.drivelink}

    return render(request, 'cardpicker/index.html', {'form': SubmitCardListForm,
                                                     'mobile': not request.user_agent.is_pc,
                                                     'sources': context})


def guide(request):
    return render(request, 'cardpicker/guide.html')


def legal(request):
    return render(request, 'cardpicker/legal.html')


def credits(request):
    total_count = f"{Card.objects.all().count():,d}"
    sources = Source.objects.all()
    context = {}
    for source in sources:
        context[source.id] = {'username': source.username,
                              'reddit': source.reddit,
                              'drivelink': source.drivelink,
                              'quantity': f"{source.quantity:,d}",
                              'description': source.description}

    return render(request, 'cardpicker/credits.html', {"sources": context,
                                                       "total_count": total_count})


def review(request):

    def search_model(lines_raw, drive_order):
        card_list = []
        cardbacks = Card.objects.filter(source__icontains="_cardback").order_by("-priority")
        cardbacks = [x.to_dict() for x in cardbacks]

        grouping = 1

        # Iterate over lines in the input list
        for line in lines_raw.splitlines():
            (cardname, qty) = process_line(line)
            if cardname:
                # If order would overflow past maximum MPC bracket, reduce this qty
                if qty > BRACKETS[-1] - len(card_list):
                    qty = BRACKETS[-1] - len(card_list)

                this_group = 0
                if qty > 1:
                    this_group = grouping
                    grouping += 2

                # Search for card results
                results = search_card(cardname, drive_order, this_group)

                # Append results to card_list
                for _ in range(0, qty):
                    card_list.append(results)

            if len(card_list) >= BRACKETS[-1]:
                # This order already has 612 cards in it - stop here
                break

        # Figure out which bracket this order lands in
        curr_bracket = BRACKETS[[x for x, val in enumerate(BRACKETS) if val >= len(card_list)][0]]

        # For donation modal, approximate how many cards I've rendered
        my_cards = 100*math.floor(Source.objects.filter(id="Chilli_Axe")[0].quantity/100)

        # Return cards, qty of cards in order, current bracket, and all cardbacks found
        return {"cards": card_list,
                "qty": len(card_list),
                "bracket": curr_bracket,
                "cardbacks": cardbacks,
                "my_cards": f"{my_cards:,d}"}

    if request.method == "POST":
        form = SubmitCardListForm(request.POST)
        if form.is_valid():
            print("Request is valid")
            # Retrieve drive order and raw user input from POST request
            drive_order = list(request.POST.get("drive_order").split(","))
            lines_raw = form['card_list'].value()
            # Search the model with the user's input and drive order, then return review page
            context = search_model(lines_raw, drive_order)
            return render(request, 'cardpicker/review.html', context)
        else:
            return render(request, 'cardpicker/index.html')
    else:
        return render(request, 'cardpicker/index.html')


def csvupload(request):

    def search_model_csv(csv_order):

        card_list = []
        cardbacks = Card.objects.filter(source__icontains="_cardback").order_by("-priority")
        cardbacks = [x.to_dict() for x in cardbacks]

        grouping = 1

        # Iterate over lines in the input list
        for line in csv_order:
            qty = line['Quantity']
            if qty:
                # try to parse qty as int
                try:
                    qty = int(qty)
                except ValueError:
                    # invalid qty
                    continue
            else:
                # for empty quantities, assume qty=1
                qty = 1
            if line['Front']:
                # If order would overflow past maximum MPC bracket, reduce this qty
                if qty > BRACKETS[-1] - len(card_list):
                    qty = BRACKETS[-1] - len(card_list)

                this_group = 0
                if qty > 1:
                    this_group = grouping
                    grouping += 2

                # Search for front card results
                results = search_card(line['Front'], drive_order, this_group)

                # If a back is specified, search for the back and append it too
                if line['Back']:
                    if qty > 1:
                        results_back = search_card(line['Back'], drive_order, this_group+1)
                    else:
                        results_back = search_card(line['Back'], drive_order)
                    results = (results[0], results_back[0])

                # Append results to card_list
                for _ in range(0, qty):
                    card_list.append(results)

            if len(card_list) >= BRACKETS[-1]:
                # This order already has 612 cards in it - stop here
                break

        # Figure out which bracket this order lands in
        curr_bracket = BRACKETS[[x for x, val in enumerate(BRACKETS) if val >= len(card_list)][0]]

        # For donation modal, approximate how many cards I've rendered
        my_cards = 1000 * math.floor(Source.objects.filter(id="Chilli_Axe")[0].quantity / 1000)

        # Return cards, qty of cards in order, current bracket, and all cardbacks found
        return {"cards": card_list,
                "qty": len(card_list),
                "bracket": curr_bracket,
                "cardbacks": cardbacks,
                "my_cards": f"{my_cards:,d}"}

    if request.method == "POST":
        form = CSVUploadForm(request.POST, request.FILES)
        if form.is_valid():
            print("Request is valid for CSV uploader")

            print(request.FILES['file'].size)

            if request.FILES['file'].size > 2000000:
                print("file 2 big")

            csv_order = uploaded_file_to_csv(request.FILES['file'].read())
            print(type(request.FILES['file']))
            drive_order = list(request.POST.get("drive_order").split(","))
            context = search_model_csv(csv_order)
            return render(request, 'cardpicker/review.html', context)
        else:
            return render(request, 'cardpicker/index.html')
    else:
        return render(request, 'cardpicker/index.html')
