import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import attr
import enlighten
import InquirerPy
from fpdf import FPDF

from src.constants import THREADS, States
from src.order import CardOrder
from src.processing import ImagePostProcessingConfig
from src.utils import bold


@attr.s
class PdfExporter:
    order: CardOrder = attr.ib(default=attr.Factory(lambda: CardOrder.from_xmls_in_folder()[0]))
    state: str = attr.ib(init=False, default=States.initialising)
    pdf: FPDF = attr.ib(default=None)
    card_width_in_inches: float = attr.ib(default=2.73)
    card_height_in_inches: float = attr.ib(default=3.71)
    file_num: int = attr.ib(default=1)
    number_of_cards_per_file: int = attr.ib(default=60)
    paths_by_slot: dict[int, tuple[str, str]] = attr.ib(default={})
    save_path: str = attr.ib(default="")
    separate_faces: bool = attr.ib(default=False)
    current_face: str = attr.ib(default="all")
    manager: enlighten.Manager = attr.ib(init=False, default=attr.Factory(enlighten.get_manager))
    status_bar: enlighten.StatusBar = attr.ib(init=False, default=False)
    download_bar: enlighten.Counter = attr.ib(init=False, default=None)
    processed_bar: enlighten.Counter = attr.ib(init=False, default=None)

    def configure_bars(self) -> None:
        num_images = len(self.order.fronts.cards_by_id) + len(self.order.backs.cards_by_id)
        status_format = "State: {state}"
        self.status_bar = self.manager.status_bar(
            status_format=status_format,
            state=f"{bold(self.state)}",
            position=1,
        )
        self.download_bar = self.manager.counter(total=num_images, desc="Images Downloaded", position=2)
        self.processed_bar = self.manager.counter(total=num_images, desc="Images Processed", position=3)

        self.download_bar.refresh()
        self.processed_bar.refresh()

    def set_state(self, state: str) -> None:
        self.state = state
        self.status_bar.update(state=f"{bold(self.state)}")
        self.status_bar.refresh()

    def __attrs_post_init__(self) -> None:
        self.ask_questions()
        self.configure_bars()
        self.generate_file_path()

    def ask_questions(self) -> None:
        questions = [
            {
                "type": "list",
                "name": "split_faces",
                "message": "Do you want the front and back of the cards in separate PDFs? (required for MPC).",
                "default": 0,
                "choices": [
                    InquirerPy.base.control.Choice(False, name="No"),
                    InquirerPy.base.control.Choice(True, name="Yes"),
                ],
            },
            {
                "type": "number",
                "name": "cards_per_file",
                "message": "How many cards should be included in the generated files? Note: The more cards per file, "
                + "the longer the processing will take and the larger the file size will be.",
                "default": 60,
                "when": lambda result: result["split_faces"] is False,
                "transformer": lambda result: 1 if (int_result := int(result)) < 1 else int_result,
            },
        ]
        answers = InquirerPy.prompt(questions)
        if answers["split_faces"]:
            self.separate_faces = True
            self.number_of_cards_per_file = 1
        else:
            self.number_of_cards_per_file = (
                1 if (int_cards_per_file := int(answers["cards_per_file"])) < 1 else int_cards_per_file
            )

    def generate_file_path(self) -> None:
        basename = os.path.basename(str(self.order.name))
        if not basename:
            basename = "cards.xml"
        file_name = os.path.splitext(basename)[0]
        self.save_path = f"export/{file_name}/"
        os.makedirs(self.save_path, exist_ok=True)
        if self.separate_faces:
            for face in ["backs", "fronts"]:
                os.makedirs(self.save_path + face, exist_ok=True)

    def generate_pdf(self) -> None:
        pdf = FPDF("P", "in", (self.card_width_in_inches, self.card_height_in_inches))
        self.pdf = pdf

    def add_image(self, image_path: str) -> None:
        self.pdf.add_page()
        self.pdf.image(image_path, x=0, y=0, w=self.card_width_in_inches, h=self.card_height_in_inches)

    def save_file(self) -> None:
        extra = ""
        if self.separate_faces:
            extra = f"{self.current_face}/"
        self.pdf.output(f"{self.save_path}{extra}{self.file_num}.pdf")

    def download_and_collect_images(self, post_processing_config: Optional[ImagePostProcessingConfig]) -> None:
        with ThreadPoolExecutor(max_workers=THREADS) as pool:
            self.order.fronts.download_images(pool, self.download_bar, post_processing_config)
            self.order.backs.download_images(pool, self.download_bar, post_processing_config)

        backs_by_slots = {}
        for card in self.order.backs.cards_by_id.values():
            for slot in card.slots:
                backs_by_slots[slot] = card.file_path

        fronts_by_slots = {}
        for card in self.order.fronts.cards_by_id.values():
            for slot in card.slots:
                fronts_by_slots[slot] = card.file_path

        paths_by_slot = {}
        for slot in fronts_by_slots.keys():
            paths_by_slot[slot] = (str(backs_by_slots.get(slot, backs_by_slots[0])), str(fronts_by_slots[slot]))
        self.paths_by_slot = paths_by_slot

    def execute(self, post_processing_config: Optional[ImagePostProcessingConfig]) -> None:
        self.download_and_collect_images(post_processing_config=post_processing_config)
        if self.separate_faces:
            self.number_of_cards_per_file = 1
            self.export_separate_faces()
        else:
            self.export()

        logging.info(f"Finished exporting files! They should be accessible at {self.save_path}.")

    def export(self) -> None:
        for slot in sorted(self.paths_by_slot.keys()):
            (back_path, front_path) = self.paths_by_slot[slot]
            self.set_state(f"Working on slot {slot}")
            if slot == 0:
                self.generate_pdf()
            elif slot % self.number_of_cards_per_file == 0:
                self.set_state(f"Saving PDF #{slot}")
                self.save_file()
                self.file_num = self.file_num + 1
                self.generate_pdf()
            self.set_state(f"Adding images for slot {slot}")
            self.add_image(back_path)
            self.add_image(front_path)
            self.processed_bar.update()

        self.set_state(f"Saving PDF #{self.file_num}")
        self.save_file()

    def export_separate_faces(self) -> None:
        all_faces = ["backs", "fronts"]
        for slot in sorted(self.paths_by_slot.keys()):
            image_paths_tuple = self.paths_by_slot[slot]
            self.set_state(f"Working on slot {slot}")
            for face in all_faces:
                face_index = all_faces.index(face)
                self.current_face = face
                self.generate_pdf()
                self.add_image(image_paths_tuple[face_index])
                self.set_state(f"Saving {face} PDF for slot {slot}")
                self.save_file()
                if face_index == 1:
                    self.file_num = self.file_num + 1
