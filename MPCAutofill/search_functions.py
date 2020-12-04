from haystack.query import SearchQuerySet
from to_searchable import to_searchable
import csv

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


def search_card_face(cardname, drive_order, grouping=0):
    # Search for a card, given its name and the drives to search
    # Return a tuple of dictionaries (returning as a dict rather than Card for Javascript access purposes)
    results = SearchQuerySet().filter(content=cardname).load_all()
    # Retrieve Card objects from search results while filtering out cardbacks
    card_objs = [x.object for x in results if "_cardback" not in x.object.source]
    cards_found = []
    for source in drive_order:
        cards_this_source = [x for x in card_objs if source in x.source]
        if cards_this_source:
            # Sort cards from this source by priority and convert them all to dicts
            priorities = [int(x.priority) for x in cards_this_source]
            cards_this_source = [x.to_dict() for _, x in sorted(zip(priorities, cards_this_source),
                                                                key=lambda pair: pair[0],
                                                                reverse=True)]
            for x in cards_this_source:
                x['grouping'] = grouping

            # Attach the search results for this source to cards_found
            cards_found.extend(cards_this_source)
    return tuple(cards_found)


def search_card(cardname, drive_order, grouping=0):
    # Search for card front and attach it to results
    cardname_split = None
    if "&" in cardname:
        cardname_split = cardname.split("&")[0]

    results_front = search_card_face(to_searchable(cardname), drive_order, grouping)
    results = (results_front,)

    if not results_front and cardname_split:
        # Search again but only consider text before the &
        return search_card(cardname_split, drive_order, grouping)

    # Determine if this card is a double-faced card
    # TODO: Not naive string contains for determining if a card is a double faced card?
    tf_result = [x for x in transforms.keys() if to_searchable(cardname) in x]
    if tf_result:
        # Search for the back face, and attach it to results
        cardname_back = transforms[tf_result[0]]
        if grouping > 0:
            results_back = search_card_face(to_searchable(cardname_back), drive_order, grouping+1)
        else:
            results_back = search_card_face(to_searchable(cardname_back), drive_order)
        if results_back:
            results = (results_front, results_back)
    if not results_front:
        results = ({"query": cardname},)
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


def uploaded_file_to_csv(csv_bytes):
    csv_string_split = csv_bytes.decode('utf-8').splitlines()
    csv_dictreader = csv.DictReader(csv_string_split)
    # TODO: Read in chunks if big?
    return csv_dictreader
