from enum import Enum, StrEnum, member
from functools import partial

import attr

import src.webdrivers as wd


class SourceType:
    AWS_S3 = "AWS S3"
    GOOGLE_DRIVE = "Google Drive"
    LOCAL_FILE = "Local File"

    @staticmethod
    def get_all() -> list[str]:
        return [SourceType.AWS_S3, SourceType.GOOGLE_DRIVE, SourceType.LOCAL_FILE]


class OrderFulfilmentMethod(StrEnum):
    new_project = "Create a new project (default)"
    append_to_project = "Add more cards to an existing project"
    continue_project = "Continue editing an existing project"

    def __str__(self) -> str:
        return self.value


class States(StrEnum):
    initialising = "Initialising"
    initialised = "Initialised"
    defining_order = "Defining Order"
    paging_to_fronts = "Paging to Fronts"
    paging_to_backs = "Paging to Backs"
    paging_to_review = "Paging to Review"
    inserting_fronts = "Inserting Fronts"
    inserting_backs = "Inserting Backs"
    finished = "Finished"


class Faces(StrEnum):
    front = "Front"
    back = "Back"


class Cardstocks(StrEnum):
    S27 = "(S27) Smooth"
    S30 = "(S30) Standard Smooth"
    S33 = "(S33) Superior Smooth"
    M31 = "(M31) Linen"
    P10 = "(P10) Plastic"


class BaseTags(StrEnum):
    details = "details"
    fronts = "fronts"
    backs = "backs"
    cardback = "cardback"
    filepath = "filepath"


class DetailsTags(StrEnum):
    quantity = "quantity"
    stock = "stock"
    foil = "foil"


class CardTags(StrEnum):
    id = "id"
    source_type = "sourceType"
    slots = "slots"
    name = "name"
    query = "query"


class Browsers(Enum):
    chrome = member(partial(wd.get_chrome_driver))
    brave = member(partial(wd.get_brave_driver))
    edge = member(partial(wd.get_edge_driver))
    # TODO: add support for firefox


# Google Drive API constants
SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/drive.readonly"]
SERVICE_ACC_FILENAME = "client_secrets.json"


class ImageResizeMethods(Enum):
    NEAREST = 0
    BOX = 4
    BILINEAR = 2
    HAMMING = 5
    BICUBIC = 3
    LANCZOS = 1


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


@attr.s
class DriveThruCardsSelectors:
    product_url: str = attr.ib()
    pdf_upload_input_selector: str = attr.ib(default="input[type='file']")
    pdf_upload_input_index: int = attr.ib(default=0)
    quantity_selector: str = attr.ib(default="")
    add_to_cart_selector: str = attr.ib(default="")
    continue_selector: str = attr.ib(default="")
    # Login selectors - two step process: click login button, then click "Go to Log in" link
    login_button_selector: str = attr.ib(default="button[data-cy='login']")
    # Target the login link in the modal, not the logout link (both can have href='/en/')
    go_to_login_selector: str = attr.ib(default=".modal a[href='/en/'], .modal-content a[href='/en/']")
    # Publisher Tools link only appears when logged in as a publisher
    logged_in_indicator_selector: str = attr.ib(default="a[href*='pub_tools.php']")


@attr.s
class DriveThruCardsSite:
    base_url: str = attr.ib(default="https://www.drivethrucards.com")
    selectors: DriveThruCardsSelectors = attr.ib(
        default=attr.Factory(lambda: DriveThruCardsSelectors(product_url="https://www.drivethrucards.com"))
    )

    @property
    def starting_url(self) -> str:
        return self.selectors.product_url


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
    PrinterStudioES = TargetSite(
        base_url="https://www.printerstudio.es",
        starting_url_route="personalizado/tarjetas-personalizadas-en-blanco.html",
        supports_foil=False,
        saved_successfully_text="Guardado satisfactoriamente",
        cardstock_site_name_mapping={
            Cardstocks.S30: "Estándar (suave)",
            Cardstocks.S33: "Superior (suave)",
            Cardstocks.M31: "De priméra calidad (lino)",
            Cardstocks.P10: "Plástico (suave)",
        },
    )
    PrinterStudioFR = TargetSite(
        base_url="https://www.printerstudio.fr",
        starting_url_route="personnalise/cartes-de-jeu-sur-mesure-cartes-blanches.html",
        supports_foil=False,
        saved_successfully_text="Enregistré avec succès",
        cardstock_site_name_mapping={
            Cardstocks.S30: "Standard (lisse)",
            Cardstocks.S33: "Supérieur (lisse)",
            Cardstocks.M31: "Premium (lin)",
            Cardstocks.P10: "Plastique (100%)",
        },
    )
    DriveThruCards = DriveThruCardsSite(
        selectors=DriveThruCardsSelectors(
            product_url="https://www.drivethrucards.com",
            pdf_upload_input_selector="input[type='file']",
        )
    )


DPI_HEIGHT_RATIO = 300 / 1110  # TODO: share this between desktop tool and backend


PROJECT_MAX_SIZE = 612  # shared between target sites
THREADS = 5  # shared between CardImageCollections

POST_LAUNCH_HTML_FILENAME = "post-launch.html"
