from enum import Enum
from functools import partial

import attr
from PIL import Image

import src.webdrivers as wd


class States(str, Enum):
    initialising = "Initialising"
    initialised = "Initialised"
    defining_order = "Defining Order"
    paging_to_fronts = "Paging to Fronts"
    paging_to_backs = "Paging to Backs"
    paging_to_review = "Paging to Review"
    inserting_fronts = "Inserting Fronts"
    inserting_backs = "Inserting Backs"
    finished = "Finished"


class Faces(str, Enum):
    front = "Front"
    back = "Back"


class Cardstocks(str, Enum):
    S27 = "(S27) Smooth"
    S30 = "(S30) Standard Smooth"
    S33 = "(S33) Superior Smooth"
    M31 = "(M31) Linen"
    P10 = "(P10) Plastic"


class BaseTags(str, Enum):
    details = "details"
    fronts = "fronts"
    backs = "backs"
    cardback = "cardback"
    filepath = "filepath"


class DetailsTags(str, Enum):
    quantity = "quantity"
    bracket = "bracket"
    stock = "stock"
    foil = "foil"


class CardTags(str, Enum):
    id = "id"
    slots = "slots"
    name = "name"
    query = "query"


class Browsers(Enum):
    chrome = partial(wd.get_chrome_driver)
    brave = partial(wd.get_brave_driver)
    edge = partial(wd.get_edge_driver)
    # TODO: add support for firefox


# Google Drive API constants
SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/drive.readonly"]
SERVICE_ACC_FILENAME = "client_secrets.json"


class ImageResizeMethods(Enum):
    NEAREST = Image.NEAREST
    BOX = Image.BOX
    BILINEAR = Image.BILINEAR
    HAMMING = Image.HAMMING
    BICUBIC = Image.BICUBIC
    LANCZOS = Image.LANCZOS


@attr.s
class TargetSite:
    """
    A simple dataclass representing a site within the MakePlayingCards group which the desktop tool can target.
    Any interactions with the site that aren't customisable through this class are presumed to work identically
    across all sites which the tool can target.
    """

    # region URLs
    base_url: str = attr.ib()
    starting_url_route: str = attr.ib()
    login_url_route: str = attr.ib(default="login.aspx")
    logout_url_route: str = attr.ib(default="logout.aspx")
    saved_projects_url_route: str = attr.ib(default="design/dn_temporary_designes.aspx")
    insert_fronts_url_route: str = attr.ib(default="products/playingcard/design/dn_playingcards_front_dynamic.aspx")
    accept_settings_url_route: str = attr.ib(default="products/pro_item_process_flow.aspx")
    # endregion
    # region project configuration
    supports_foil: bool = attr.ib(default=True)
    quantity_dropdown_element_id: str = attr.ib(default="dro_choosesize")
    cardstock_dropdown_element_id: str = attr.ib(default="dro_paper_type")
    print_type_dropdown_element_id: str = attr.ib(default="dro_product_effect")
    foil_dropdown_element_value: str = attr.ib(default="EF_055")
    cardstock_site_name_mapping: dict[Cardstocks, str] = attr.ib(
        default={cardstock: cardstock.value for cardstock in Cardstocks}
    )
    # endregion
    # region save states
    saved_successfully_text: str = attr.ib(default="Saved successfully")
    # endregion

    def format_url(self, url: str) -> str:
        return f"{self.base_url}/{url}"

    @property
    def starting_url(self) -> str:
        return self.format_url(self.starting_url_route)

    @property
    def login_url(self) -> str:
        return self.format_url(self.login_url_route)

    @property
    def logout_url(self) -> str:
        return self.format_url(self.logout_url_route)

    @property
    def saved_projects_url(self) -> str:
        return self.format_url(self.saved_projects_url_route)

    @property
    def insert_fronts_url(self) -> str:
        return self.format_url(self.insert_fronts_url_route)

    @property
    def accept_settings_url(self) -> str:
        return self.format_url(self.accept_settings_url_route)


class TargetSites(Enum):
    MakePlayingCards = TargetSite(
        base_url="https://www.makeplayingcards.com", starting_url_route="design/custom-blank-card.html"
    )
    PrinterStudio = TargetSite(
        base_url="https://www.printerstudio.com",
        starting_url_route="personalized/custom-playing-cards-blank-cards.html",
        supports_foil=False,
        cardstock_site_name_mapping={
            Cardstocks.S30: "Standard (smooth)",
            Cardstocks.S33: "Superior (smooth)",
            Cardstocks.M31: "Premium (linen)",
            Cardstocks.P10: "Plastic (100%)",
        },
    )
    PrinterStudioUK = TargetSite(
        base_url="https://www.printerstudio.co.uk",
        starting_url_route="personalised/custom-playing-cards-blank-cards.html",
        supports_foil=False,
        cardstock_site_name_mapping={
            Cardstocks.S30: "Standard (smooth)",
            Cardstocks.S33: "Superior (smooth)",
            Cardstocks.M31: "Premium (linen)",
            Cardstocks.P10: "Plastic (100%)",
        },
    )
    PrinterStudioDE = TargetSite(
        base_url="https://www.printerstudio.de",
        starting_url_route="machen/blanko-spielkarten-63x88mm-personalisieren.html",
        supports_foil=False,
        saved_successfully_text="Speicherung erfolgreich",
        cardstock_site_name_mapping={
            Cardstocks.S30: "Standard (glatt)",
            Cardstocks.S33: "Super (glatt)",
            Cardstocks.M31: "Premium (linen)",
            Cardstocks.P10: "Kunststoff",
        },
    )
    PrinterStudioFR = TargetSite(
        base_url="https://www.printerstudio.fr",
        starting_url_route="personnalise/cartes-de-jeu-sur-mesure-cartes-blanches.html",
        supports_foil=False,
        cardstock_site_name_mapping={
            Cardstocks.S30: "Standard (lisse)",
            Cardstocks.S33: "Superieur (lisse)",
            Cardstocks.M31: "Premium (lin)",
            Cardstocks.P10: "Plastic (100%)",
        },
    )

DPI_HEIGHT_RATIO = 300 / 1110  # TODO: share this between desktop tool and backend


PROJECT_MAX_SIZE = 612  # shared between target sites
THREADS = 5  # shared between CardImageCollections

POST_LAUNCH_HTML_FILENAME = "post-launch.html"
