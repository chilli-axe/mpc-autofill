import csv
import math

import chardet
import defusedxml.ElementTree as ET
from elasticsearch_dsl.query import Match

from cardpicker.documents import CardSearch, CardbackSearch, TokenSearch
from cardpicker.forms import InputText
from cardpicker.models import Source
from to_searchable import to_searchable


def build_context(drive_order, order, qty):
    # I found myself copy/pasting this between the three input methods so I figured it belonged in its own function

    # For donation modal, approximate how many cards I've rendered
    my_cards = 100 * math.floor(Source.objects.filter(id="Chilli_Axe")[0].qty_cards / 100)

    context = {
        "form": InputText,
        "drive_order": drive_order,
        "order": order,
        "qty": qty,
        "my_cards": f"{my_cards:,d}",
    }

    return context


def text_to_list(input_text):
    # Helper function to translate strings like "[2, 4, 5, 6]" into lists
    if input_text == "":
        return []
    return [int(x) for x in input_text.strip('][').replace(" ", "").split(',')]


# Hardcode transform card front/back pairs
transforms = {'Aberrant Researcher': 'Perfected Form',
              'Accursed Witch': 'Infectious Curse',
              'Afflicted Deserter': 'Werewolf Ransacker',
              'Archangel Avacyn': 'Avacyn, the Purifier',
              "Arguel's Blood Fast": 'Temple of Aclazotz',
              'Arlinn Kord': 'Arlinn, Embraced by the Moon',
              'Autumnal Gloom': 'Ancient of the Equinox',
              'Avacynian Missionaries': 'Lunarch Inquisitors',
              "Azor's Gateway": 'Sanctum of the Sun',
              'Bloodline Keeper': 'Lord of Lineage',
              'Breakneck Rider': 'Neck Breaker',
              'Chalice of Life': 'Chalice of Death',
              'Chandra, Fire of Kaladesh': 'Chandra, Roaring Flame',
              'Chosen of Markov': "Markov's Servant",
              'Civilized Scholar': 'Homicidal Brute',
              'Cloistered Youth': 'Unholy Fiend',
              'Conduit of Storms': 'Conduit of Emrakul',
              "Conqueror's Galleon": "Conqueror's Foothold",
              'Convicted Killer': 'Branded Howler',
              'Cryptolith Fragment': 'Aurora of Emrakul',
              'Curious Homunculus': 'Voracious Reader',
              'Daring Sleuth': 'Bearer of Overwhelming Truths',
              'Daybreak Ranger': 'Nightfall Predator',
              'Delver of Secrets': 'Insectile Aberration',
              'Docent of Perfection': 'Final Iteration',
              'Dowsing Dagger': 'Lost Vale',
              'Duskwatch Recruiter': 'Krallenhorde Howler',
              'Elbrus, the Binding Blade': 'Withengar Unbound',
              'Elusive Tormentor': 'Insidious Mist',
              'Extricator of Sin': 'Extricator of Flesh',
              'Garruk Relentless': 'Garruk, the Veil-Cursed',
              'Gatstaf Arsonists': 'Gatstaf Ravagers',
              'Gatstaf Shepherd': 'Gatstaf Howler',
              'Geier Reach Bandit': 'Vildin-Pack Alpha',
              'Golden Guardian': 'Gold-Forge Garrison',
              'Grizzled Angler': 'Grisly Anglerfish',
              'Grizzled Outcasts': 'Krallenhorde Wantons',
              'Growing Rites of Itlimoc': 'Itlimoc, Cradle of the Sun',
              "Hadana's Climb": 'Winged Temple of Orazca',
              'Hanweir Militia Captain': 'Westvale Cult Leader',
              'Hanweir Watchkeep': 'Bane of Hanweir',
              'Harvest Hand': 'Scrounged Scythe',
              'Heir of Falkenrath': 'Heir to the Night',
              'Hermit of the Natterknolls': 'Lone Wolf of the Natterknolls',
              'Hinterland Hermit': 'Hinterland Scourge',
              'Hinterland Logger': 'Timber Shredder',
              'Huntmaster of the Fells': 'Ravager of the Fells',
              'Instigator Gang': 'Wildblood Pack',
              "Jace, Vryn's Prodigy": 'Jace, Telepath Unbound',
              'Journey to Eternity': 'Atzal, Cave of Eternity',
              'Kessig Forgemaster': 'Flameheart Werewolf',
              'Kessig Prowler': 'Sinuous Predator',
              'Kindly Stranger': 'Demon-Possessed Witch',
              'Kruin Outlaw': 'Terror of Kruin Pass',
              'Kytheon, Hero of Akros': 'Gideon, Battle-Forged',
              'Lambholt Elder': 'Silverpelt Werewolf',
              'Lambholt Pacifist': 'Lambholt Butcher',
              "Legion's Landing": 'Adanto, the First Fort',
              'Liliana, Heretical Healer': 'Liliana, Defiant Necromancer',
              'Lone Rider': 'It That Rides as One',
              'Loyal Cathar': 'Unhallowed Cathar',
              "Ludevic's Test Subject": "Ludevic's Abomination",
              'Mayor of Avabruck': 'Howlpack Alpha',
              'Mondronen Shaman': "Tovolar's Magehunter",
              'Neglected Heirloom': 'Ashmouth Blade',
              'Nicol Bolas, the Ravager': 'Nicol Bolas, the Arisen',
              'Nissa, Vastwood Seer': 'Nissa, Sage Animist',
              'Path of Mettle': 'Metzali, Tower of Triumph',
              'Pious Evangel': 'Wayward Disciple',
              'Primal Amulet': 'Primal Wellspring',
              'Profane Procession': 'Tomb of the Dusk Rose',
              'Ravenous Demon': 'Archdemon of Greed',
              'Reckless Waif': 'Merciless Predator',
              'Sage of Ancient Lore': 'Werewolf of Ancient Hunger',
              'Scorned Villager': 'Moonscarred Werewolf',
              'Screeching Bat': 'Stalking Vampire',
              'Search for Azcanta': 'Azcanta, the Sunken Ruin',
              'Shrill Howler': 'Howling Chorus',
              'Skin Invasion': 'Skin Shedder',
              'Smoldering Werewolf': 'Erupting Dreadwolf',
              'Solitary Hunter': 'One of the Pack',
              'Soul Seizer': 'Ghastly Haunting',
              'Startled Awake': 'Persistent Nightmare',
              'Storm the Vault': 'Vault of Catlacan',
              'Tangleclaw Werewolf': 'Fibrous Entangler',
              'Thaumatic Compass': 'Spires of Orazca',
              'Thing in the Ice': 'Awoken Horror',
              'Thraben Gargoyle': 'Stonewing Antagonizer',
              'Thraben Sentry': 'Thraben Militia',
              'Tormented Pariah': 'Rampaging Werewolf',
              'Town Gossipmonger': 'Incited Rabble',
              'Treasure Map': 'Treasure Cove',
              'Ulrich of the Krallenhorde': 'Ulrich, Uncontested Alpha',
              'Ulvenwald Captive': 'Ulvenwald Abomination',
              'Ulvenwald Mystics': 'Ulvenwald Primordials',
              'Uninvited Geist': 'Unimpeded Trespasser',
              "Vance's Blasting Cannons": 'Spitfire Bastion',
              'Vildin-Pack Outcast': 'Dronepack Kindred',
              'Village Ironsmith': 'Ironfang',
              'Village Messenger': 'Moonrise Intruder',
              'Villagers of Estwald': 'Howlpack of Estwald',
              'Voldaren Pariah': 'Abolisher of Bloodlines',
              'Westvale Abbey': 'Ormendahl, Profane Prince',
              'Wolfbitten Captive': 'Krallenhorde Killer',
              'Gisela, the Broken Blade': 'Brisela, Voice of Nightmares Top',
              'Bruna, the Fading Light': 'Brisela, Voice of Nightmares Bottom',
              'Hanweir Battlements': 'Hanweir, the Writhing Township Top',
              'Hanweir Garrison': 'Hanweir, the Writhing Township Bottom',
              'Graf Rats': 'Chittering Host Top',
              'Midnight Scavengers': 'Chittering Host Bottom',
              "Agadeem's Awakening": 'Agadeem, the Undercrypt',
              'Akoum Warrior': 'Akoum Teeth',
              'Bala Ged Recovery': 'Bala Ged Sanctuary',
              'Beyeen Veil': 'Beyeen Coast',
              'Blackbloom Rogue': 'Blackbloom Bog',
              'Branchloft Pathway': 'Boulderloft Pathway',
              'Brightclimb Pathway': 'Grimclimb Pathway',
              'Clearwater Pathway': 'Murkwater Pathway',
              'Cragcrown Pathway': 'Timbercrown Pathway',
              "Emeria's Call": 'Emeria, Shattered Skyclave',
              'Glasspool Mimic': 'Glasspool Shore',
              'Hagra Mauling': 'Hagra Broodpit',
              'Jwari Disruption': 'Jwari Ruins',
              'Kabira Takedown': 'Kabira Plateau',
              'Kazandu Mammoth': 'Kazandu Valley',
              "Kazuul's Fury": "Kazuul's Cliffs",
              'Khalni Ambush': 'Khalni Territory',
              'Makindi Stampede': 'Makindi Mesas',
              'Malakir Rebirth': 'Malakir Mire',
              'Needleverge Pathway': 'Pillarverge Pathway',
              'Ondu Inversion': 'Ondu Skyruins',
              'Pelakka Predation': 'Pelakka Caverns',
              'Riverglide Pathway': 'Lavaglide Pathway',
              'Sea Gate Restoration': 'Sea Gate, Reborn',
              'Sejiri Shelter': 'Sejiri Glacier',
              'Shatterskull Smashing': 'Shatterskull, the Hammer Pass',
              'Silundi Vision': 'Silundi Isle',
              'Skyclave Cleric': 'Skyclave Basilica',
              'Song-Mad Treachery': 'Song-Mad Ruins',
              'Spikefield Hazard': 'Spikefield Cave',
              'Tangled Florahedron': 'Tangled Vale',
              'Turntimber Symbiosis': 'Turntimber, Serpentine Wood',
              'Umara Wizard': 'Umara Skyfalls',
              'Valakut Awakening': 'Valakut Stoneforge',
              'Vastwood Fortification': 'Vastwood Thicket',
              'Zof Consumption': 'Zof Bloodbog',
              }

transforms = dict((to_searchable(x), to_searchable(y)) for x, y in transforms.items())


def query_es_card(drive_order, query):
    return search_database(drive_order, query, CardSearch.search())


def query_es_cardback():
    # return all cardbacks in the search index
    s = CardbackSearch.search()
    hits = s \
        .sort({'priority': {'order': 'desc'}}) \
        .params(preserve_order=True) \
        .scan()
    results = [x.to_dict() for x in hits]
    return results


def query_es_token(drive_order, query):
    return search_database(drive_order, query, TokenSearch.search())


def search_database(drive_order, query, s):
    # TODO: elasticsearch_dsl.serializer.serializer ?
    # search through the database for a given query, over the drives specified in drive_orders,
    # using the search index specified in s (this enables reuse of code between Card and Token search functions)

    results = []

    # set up search - match the query and use the AND operator
    match = Match(searchq={"query": to_searchable(query), "operator": "AND"})

    # iterate over drives, filtering on the current drive, ordering by priority in descending order,
    # then add the returned hits to the results list
    for drive in drive_order:
        hits = s \
            .query(match) \
            .filter('match', source=drive) \
            .sort({'priority': {'order': 'desc'}}) \
            .params(preserve_order=True) \
            .scan()
        results += [x.to_dict() for x in hits]

    return results


def process_line(input_str):
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


class OrderDict:
    # small wrapper for a dictionary so it's easy to insert stuff into the order
    def __init__(self):
        # initialise the dictionary and set up the cardback's entry
        # self.order = {"": {
        self.order = {"front": {}, "back": {
            "": {
                "slots": [["-", ""]],
                "req_type": "back",
            }
        }}

    def insert(self, query, slots, face, req_type, selected_img):
        # stick a thing into the order dict
        slots_with_id = [[x, selected_img] for x in slots]
        if query not in self.order[face].keys():
            self.order[face][query] = {
                "slots": slots_with_id,
                "req_type": req_type,
            }
        else:
            self.order[face][query]["slots"] += slots_with_id

    def insert_back(self, slots):
        # add onto the common cardback's slots
        slots_with_id = [[x, ""] for x in slots]
        self.order["back"][""]["slots"] += slots_with_id


def parse_text(input_lines, offset=0):
    cards_dict = OrderDict()

    curr_slot = offset

    # loop over lines in the input text, and for each, parse it into usable information
    for line in input_lines.splitlines():
        # extract the query and quantity from the current line of the input text
        (query, qty) = process_line(line)

        if query:
            # cap at 612
            over_cap = False
            if qty + curr_slot >= 612:
                qty = 612 - curr_slot
                over_cap = True

            req_type = ""
            curr_slots = list(range(curr_slot, curr_slot + qty))

            # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
            query_faces = [query, ""]
            if '&' in query_faces[0]:
                query_split = [to_searchable(x) for x in query.split(" & ")]
                if query_split[0] in transforms.keys() and query_split[1] in transforms.values():
                    query_faces = query_split
            elif query[0:2].lower() == "t:":
                query_faces[0] = to_searchable(query[2:])
                req_type = "token"
            else:
                query_faces[0] = to_searchable(query)
                # gotta check if query is the front of a DFC here as well
                if query_faces[0] in transforms.keys():
                    query_faces = [query, transforms[query_faces[0]]]

            # stick the front face into the dictionary
            cards_dict.insert(query_faces[0], curr_slots, "front", req_type, "")

            if query_faces[1]:
                # is a DFC, gotta add the back face to the correct slots
                cards_dict.insert(query_faces[1], curr_slots, "back", req_type, "")

            else:
                # is not a DFC, so add this card's slots onto the common cardback's slots
                cards_dict.insert_back(curr_slots)

            curr_slot += qty

            if over_cap:
                break

    return cards_dict.order, curr_slot - offset


def parse_csv(csv_bytes):
    # TODO: I'm sure this can be optimised
    cards_dict = OrderDict()
    curr_slot = 0

    # support for different types of encoding - detect the encoding type then decode the given bytes according to that
    csv_format = chardet.detect(csv_bytes)
    csv_string_split = csv_bytes.decode(csv_format['encoding']).splitlines()

    # handle case where csv doesn't have correct headers
    headers = 'Quantity,Front,Back'
    if csv_string_split[0] != headers:
        # this CSV doesn't appear to have the correct column headers, so we'll attach them here
        csv_string_split = [headers] + csv_string_split
    csv_dictreader = csv.DictReader(csv_string_split)

    for line in csv_dictreader:
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

        # only care about lines with a front specified
        if line['Front']:
            # the slots for this line in the CSV
            curr_slots = list(range(curr_slot, curr_slot + qty))

            # insert front image
            # if the front is a transform card, its back should be the reverse side of that transform card
            back_query = line['Back']

            # if a back is specified, insert the back
            # otherwise, add these slots to the common cardback

            query_faces = [line['Front'], line['Back']]
            req_type = "normal"

            if not line['Back']:
                # potentially doing transform things, because a back wasn't specified
                # first, determine if this card is a DFC by virtue of it having its two faces separated by an ampersand
                if '&' in query_faces[0]:
                    query_split = [to_searchable(x) for x in query.split(" & ")]
                    if query_split[0] in transforms.keys() and query_split[1] in transforms.values():
                        query_faces = query_split
                elif query_faces[0][0:2].lower() == "t:":
                    query_faces[0] = to_searchable(query_faces[0][2:])
                    req_type = "token"
                else:
                    # gotta check if query is the front of a DFC here as well
                    query_faces[0] = to_searchable(query_faces[0])
                    if query_faces[0] in transforms.keys():
                        query_faces = [query_faces[0], transforms[query_faces[0]]]

            # ensure everything has been converted to searchable
            query_faces = [to_searchable(x) for x in query_faces]

            # stick the front face into the dictionary
            cards_dict.insert(query_faces[0], curr_slots, "front", req_type, "")

            if query_faces[1]:
                # is a DFC, gotta add the back face to the correct slots
                cards_dict.insert(query_faces[1], curr_slots, "back", req_type, "")

            else:
                # is not a DFC, so add this card's slots onto the common cardback's slots
                cards_dict.insert_back(curr_slots)

            curr_slot += qty

    print(cards_dict.order)

    # TODO: Read in chunks if big?
    return cards_dict.order, curr_slot


def parse_xml(input_text, offset=0):
    # TODO: gotta set up cardback IDs for cards which use the default cardback
    # TODO: don't include the right panel cardabck in this dict, bc it'll overwrite the cardback they had?

    # note: this raises an IndexError if you upload an old xml (which doesn't include the search query), and this
    # exception is handled in the view that calls parse_xml
    # TODO: handle the exception here and return nothing
    cards_dict = OrderDict()

    qty = 0  # should be qty = 0 but was qty = offset?
    root = ET.fromstring(input_text)

    # TODO this might be kinda shit, idk, come back to it later

    def xml_parse_face(elem, face):
        print(elem)
        all_slots = []
        for child in elem:
            # structure: id, slots, name, query
            card_id = child[0].text
            slots = [x + offset for x in text_to_list(child[1].text)]
            # filter out slot numbers greater than or equal to 612
            slots = [x for x in slots if x < 612]
            if slots:
                all_slots += slots
                query = child[3].text
                cards_dict.insert(query, slots, face, "", card_id)

        return set(all_slots)

    # parse the fronts first to get a list of slots in the order
    all_slots = xml_parse_face(root[1], "front")
    # count how many slots we have for qty
    qty = len(all_slots)
    if root[2].tag == "backs":
        # remove the back slots from all_slots, leaving us with just slots with the common cardback
        all_slots -= xml_parse_face(root[2], "back")

    cards_dict.insert_back(list(all_slots))

    return cards_dict.order, qty
