import os

import attr
import InquirerPy
from fpdf import FPDF

from src.order import CardOrder
from src.utils import ValidationException


@attr.s
class PdfExporter:
    pdf: FPDF = attr.ib(default=None)
    order: CardOrder = attr.ib(default=None)
    card_width_in_inches: float = attr.ib(default=2.73)
    card_height_in_inches: float = attr.ib(default=3.71)
    file_num: int = attr.ib(default=1)
    number_of_cards_per_file: int = attr.ib(default=100)
    paths_by_slot: dict = attr.ib(default={})
    save_path: str = attr.ib(default="")
    separate_faces: bool = attr.ib(default=False)
    current_face: str = attr.ib(default="all")

    def __attrs_post_init__(self) -> None:
        self.ask_questions()
        self.generate_file_path()
        self.collect_images()

    def ask_questions(self):
        questions = [
            {
                "type": "list",
                "name": "split_faces",
                "message": "Do you want the front and back of the cards in separate PDFs? (required for MPC).",
                "default": 0,
                "choices": [InquirerPy.base.control.Choice(False, name="No"),
                            InquirerPy.base.control.Choice(True, name="Yes")]
            },
            {
                "type": "number",
                "name": "cards_per_file",
                "message": "How many cards should be included in the generated files? Note: The more cards per file, " +
                           "the longer the processing will take and the larger the file size will be.",
                "default": 60,
                "when": lambda result: result["split_faces"] is False,
                "transformer": lambda result: 1 if int(result) < 1 else int(result)
            }
        ]
        answers = InquirerPy.prompt(questions)
        if answers["split_faces"]:
            self.separate_faces = True
            self.number_of_cards_per_file = 1
        else:
            self.number_of_cards_per_file = 1 if int(answers["cards_per_file"]) < 1 else int(answers["cards_per_file"])

    def generate_file_path(self) -> None:
        file_name = os.path.splitext(os.path.basename(self.order.name))[0]
        self.save_path = "export/%s/" % file_name
        os.makedirs(self.save_path, exist_ok=True)
        if self.separate_faces:
            for face in ['backs', 'fronts']:
                os.makedirs(self.save_path + face, exist_ok=True)

    def generate_pdf(self) -> None:
        pdf = FPDF('P', 'in', (self.card_width_in_inches, self.card_height_in_inches))
        self.pdf = pdf

    def add_image(self, image_path: str) -> None:
        self.pdf.add_page()
        self.pdf.image(image_path, x=0, y=0, w=self.card_width_in_inches, h=self.card_height_in_inches)

    def save_file(self) -> None:
        extra = ''
        if self.separate_faces:
            extra = "%s/" % self.current_face
        self.pdf.output(self.save_path + extra + str(self.file_num) + '.pdf')

    def collect_images(self) -> None:
        backs_by_slots = {}
        for card in self.order.backs.cards:
            for slot in card.slots:
                backs_by_slots[slot] = card.file_path

        fronts_by_slots = {}
        for card in self.order.fronts.cards:
            for slot in card.slots:
                fronts_by_slots[slot] = card.file_path

        paths_by_slot = {}
        for slot in fronts_by_slots.keys():
            paths_by_slot[slot] = (backs_by_slots.get(slot, backs_by_slots[0]), fronts_by_slots[slot])
        self.paths_by_slot = paths_by_slot

    def execute(self) -> None:
        if self.separate_faces:
            self.number_of_cards_per_file = 1
            self.export_separate_faces()
        else:
            self.export()

        print('Finished exporting files! They should be accessible at %s' % self.save_path)

    def export(self) -> None:
        for slot in sorted(self.paths_by_slot.keys()):
            (back_path, front_path) = self.paths_by_slot[slot]
            print('Working on slot %s' % str(slot))
            if slot == 0:
                self.generate_pdf()
            elif slot % self.number_of_cards_per_file == 0:
                print('Saving PDF #%s' % str(self.file_num))
                self.save_file()
                self.file_num = self.file_num + 1
                self.generate_pdf()
            print('Adding images for slot %s' % str(slot))
            self.add_image(back_path)
            self.add_image(front_path)

        print('Saving PDF #%s' % str(self.file_num))
        self.save_file()

    def export_separate_faces(self) -> None:
        all_faces = ['backs', 'fronts']
        for slot in sorted(self.paths_by_slot.keys()):
            image_paths_tuple = self.paths_by_slot[slot]
            print('Working on slot ' + str(slot))
            for face in all_faces:
                face_index = all_faces.index(face)
                self.current_face = face
                self.generate_pdf()
                self.add_image(image_paths_tuple[face_index])
                print('Saving %s PDF for slot %s' % (face, str(slot)))
                self.save_file()
                if face_index == 1:
                    self.file_num = self.file_num + 1
