import io
from dataclasses import dataclass

import numpy as np
from PIL import Image

from src.constants import DPI_HEIGHT_RATIO, ImageResizeMethods


@dataclass
class ImagePostProcessingConfig:
    max_dpi: int
    downscale_alg: ImageResizeMethods
    # jpeg: bool


def post_process_image(raw_image: list[int], config: ImagePostProcessingConfig) -> Image:
    # bit of a thick one-liner here - clip data to [0, 255], convert to bytes, convert to BytesIO, read into pillow img
    img = Image.open(io.BytesIO(bytes(np.array(raw_image).astype(np.uint8))))

    # downscale the image to `max_dpi`
    img_dpi = DPI_HEIGHT_RATIO * img.height
    if img_dpi > config.max_dpi:
        new_height = round((config.max_dpi / img_dpi) * img.height)
        new_width = round((config.max_dpi / img_dpi) * img.width)
        img = img.resize((new_width, new_height), config.downscale_alg.value)

    return img
