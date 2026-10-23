import io
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, BinaryIO, Optional

from src.constants import DPI_HEIGHT_RATIO, ImageResizeMethods

if TYPE_CHECKING:
    from PIL.Image import Image

# DriveThruCards physical card dimensions (Premium Euro Poker with bleed)
# DriveThruCards requires 2.73" x 3.71" which includes bleed area
DTC_CARD_WIDTH_INCHES = 2.73
DTC_CARD_HEIGHT_INCHES = 3.71


def calculate_dtc_target_pixel_size(target_dpi: int) -> tuple[int, int]:
    """
    Calculate the target pixel dimensions for DriveThruCards at the specified DPI.
    Card size is 2.73" x 3.71" (Premium Euro Poker with bleed).
    """
    width = max(1, round(DTC_CARD_WIDTH_INCHES * target_dpi))
    height = max(1, round(DTC_CARD_HEIGHT_INCHES * target_dpi))
    return (width, height)


@dataclass
class ImagePostProcessingConfig:
    max_dpi: int
    downscale_alg: ImageResizeMethods
    output_format: Optional[str] = None
    jpeg_quality: int = 95
    target_pixel_size: Optional[tuple[int, int]] = None
    embed_dpi_metadata: bool = False


def post_process_image(raw_image: bytes, config: ImagePostProcessingConfig) -> "Image":
    from PIL import Image

    img = Image.open(io.BytesIO(raw_image))
    if config.output_format and config.output_format.upper() == "JPEG":
        if "A" in img.getbands() or "transparency" in img.info:
            rgba = img.convert("RGBA")
            img = Image.new("RGB", rgba.size, "white")
            img.paste(rgba, mask=rgba.getchannel("A"))
        elif img.mode not in ("RGB", "L", "CMYK"):
            img = img.convert("RGB")

    # downscale the image to `max_dpi`
    if config.target_pixel_size:
        target_width, target_height = config.target_pixel_size
        if img.width != target_width or img.height != target_height:
            # For DTC, force exact pixel size to guarantee 300 DPI at 2.73" x 3.71".
            img = img.resize((target_width, target_height), config.downscale_alg.value)
    else:
        img_dpi = 10 * round(int(img.height) * DPI_HEIGHT_RATIO / 10)
        if img_dpi > config.max_dpi:
            new_height = round((config.max_dpi / img_dpi) * img.height)
            new_width = round((config.max_dpi / img_dpi) * img.width)
            img = img.resize((new_width, new_height), config.downscale_alg.value)

    return img


def save_processed_image(
    img: "Image",
    file_path: str | BinaryIO,
    config: ImagePostProcessingConfig,
) -> None:
    # Remove XMP data if it's present in the image info to avoid "XMP data is too long" error.
    # JPEG format has a 64KB limit for XMP metadata in a single APP1 segment.
    if "xmp" in img.info:
        img.info.pop("xmp")

    img.save(file_path, **_build_save_kwargs(config=config))


def _build_save_kwargs(config: ImagePostProcessingConfig) -> dict[str, Any]:
    save_kwargs: dict[str, Any] = {}
    if config.output_format:
        save_kwargs["format"] = config.output_format
    if config.output_format and config.output_format.upper() == "JPEG":
        save_kwargs["quality"] = config.jpeg_quality
        save_kwargs["subsampling"] = 0
        save_kwargs["optimize"] = True
    # Embed DPI metadata to ensure PDF tools correctly interpret the image resolution.
    # This is critical for DriveThruCards where the target DPI must be 300.
    if config.embed_dpi_metadata and config.target_pixel_size:
        # Calculate DPI from target pixel size and DTC card dimensions
        target_width, target_height = config.target_pixel_size
        dpi_x = round(target_width / DTC_CARD_WIDTH_INCHES)
        dpi_y = round(target_height / DTC_CARD_HEIGHT_INCHES)
        save_kwargs["dpi"] = (dpi_x, dpi_y)
    return save_kwargs
