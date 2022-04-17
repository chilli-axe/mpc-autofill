from enum import Enum


class States(str, Enum):
    initialising = "Initialising"
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


class GoogleScriptsAPIs(str, Enum):
    image_name = "https://script.google.com/macros/s/AKfycbw90rkocSdppkEuyVdsTuZNslrhd5zNT3XMgfucNMM1JjhLl-Q/exec"
    image_content = (
        "https://script.google.com/macros/s/AKfycbzzCWc2x3tfQU1Zp45LB1P19FNZE-4njwzfKT5_Rx399h-5dELZWyvf/exec"
    )


BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612]
THREADS = 5  # shared between CardImageCollections
