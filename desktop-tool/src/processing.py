import io
from dataclasses import dataclass

from PIL import Image, ImageOps

from src.constants import DPI_HEIGHT_RATIO, ImageResizeMethods


@dataclass
class ImagePostProcessingConfig:
    max_dpi: int
    downscale_alg: ImageResizeMethods
    # jpeg: bool


def _add_black_border(image: Image.Image, border_size: int) -> Image.Image:
    """Adds a black border to a given Pillow image object."""
    return ImageOps.expand(image, border=border_size, fill="black")


def post_process_image(raw_image: bytes, config: ImagePostProcessingConfig) -> Image.Image:
    img = Image.open(io.BytesIO(raw_image))

    # downscale the image to `max_dpi`
    img_dpi = 10 * round(int(img.height) * DPI_HEIGHT_RATIO / 10)
    if img_dpi > config.max_dpi:
        new_height = round((config.max_dpi / img_dpi) * img.height)
        new_width = round((config.max_dpi / img_dpi) * img.width)
        img = img.resize((new_width, new_height), config.downscale_alg.value)

    return img
