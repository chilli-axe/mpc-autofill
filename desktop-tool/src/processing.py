import io
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, Tuple, Dict, Any

from src.constants import DPI_HEIGHT_RATIO, ImageResizeMethods
from src.logging import logger

if TYPE_CHECKING:
    from PIL import Image

# DriveThruCards physical card dimensions in mm
DTC_CARD_WIDTH_MM = 63
DTC_CARD_HEIGHT_MM = 88
MM_PER_INCH = 25.4


def calculate_dtc_target_pixel_size(target_dpi: int) -> Tuple[int, int]:
    """
    Calculate the target pixel dimensions for DriveThruCards at the specified DPI.
    Card size is 63mm x 88mm.
    """
    width = max(1, round((DTC_CARD_WIDTH_MM / MM_PER_INCH) * target_dpi))
    height = max(1, round((DTC_CARD_HEIGHT_MM / MM_PER_INCH) * target_dpi))
    return (width, height)


@dataclass
class ImagePostProcessingConfig:
    max_dpi: int
    downscale_alg: ImageResizeMethods
    output_format: Optional[str] = None
    output_extension: Optional[str] = None
    convert_to_cmyk: bool = False
    icc_profile_path: Optional[str] = None
    output_directory: Optional[str] = None
    jpeg_quality: int = 95
    target_pixel_size: Optional[Tuple[int, int]] = None
    embed_dpi_metadata: bool = False


def get_post_processed_path(file_path: str, config: ImagePostProcessingConfig) -> str:
    directory = config.output_directory or os.path.dirname(file_path)
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    extension = config.output_extension or os.path.splitext(file_path)[1]
    return os.path.join(directory, f"{base_name}{extension}")


def _apply_color_processing(
    img: "Image", config: ImagePostProcessingConfig
) -> Tuple["Image", Optional[bytes]]:
    icc_profile_bytes = None
    if config.convert_to_cmyk:
        if img.mode in ("RGBA", "LA"):
            img = img.convert("RGB")
        elif img.mode not in ("RGB", "CMYK"):
            img = img.convert("RGB")
        if config.icc_profile_path:
            try:
                from PIL import ImageCms

                srgb = ImageCms.createProfile("sRGB")
                cmyk_profile = ImageCms.getOpenProfile(config.icc_profile_path)
                img = ImageCms.profileToProfile(img, srgb, cmyk_profile, outputMode="CMYK")
                icc_profile_bytes = cmyk_profile.tobytes()
            except Exception as exc:
                logger.warning(f"Failed to apply ICC profile ({config.icc_profile_path}): {exc}")
                img = img.convert("CMYK")
        else:
            img = img.convert("CMYK")
    elif config.output_format and config.output_format.upper() == "JPEG":
        if img.mode in ("RGBA", "LA"):
            img = img.convert("RGB")
    return img, icc_profile_bytes


def post_process_image(raw_image: bytes, config: ImagePostProcessingConfig) -> Tuple["Image", Optional[bytes]]:
    from PIL import Image

    img = Image.open(io.BytesIO(raw_image))

    # downscale the image to `max_dpi`
    if config.target_pixel_size:
        target_width, target_height = config.target_pixel_size
        if img.width != target_width or img.height != target_height:
            # For DTC, force exact pixel size to guarantee 300 DPI at 63x88mm.
            img = img.resize((target_width, target_height), config.downscale_alg.value)
    else:
        img_dpi = 10 * round(int(img.height) * DPI_HEIGHT_RATIO / 10)
        if img_dpi > config.max_dpi:
            new_height = round((config.max_dpi / img_dpi) * img.height)
            new_width = round((config.max_dpi / img_dpi) * img.width)
            img = img.resize((new_width, new_height), config.downscale_alg.value)

    img, icc_profile_bytes = _apply_color_processing(img, config)
    return img, icc_profile_bytes


def save_processed_image(
    img: "Image",
    file_path: str,
    config: ImagePostProcessingConfig,
    icc_profile_bytes: Optional[bytes] = None,
) -> None:
    img.save(file_path, **_build_save_kwargs(config=config, icc_profile_bytes=icc_profile_bytes))


def save_processed_image_to_bytes(
    img: "Image",
    config: ImagePostProcessingConfig,
    icc_profile_bytes: Optional[bytes] = None,
) -> bytes:
    output = io.BytesIO()
    img.save(output, **_build_save_kwargs(config=config, icc_profile_bytes=icc_profile_bytes))
    output.seek(0)
    return output.read()


def _build_save_kwargs(
    config: ImagePostProcessingConfig,
    icc_profile_bytes: Optional[bytes],
) -> Dict[str, Any]:
    save_kwargs: Dict[str, Any] = {}
    if config.output_format:
        save_kwargs["format"] = config.output_format
    if config.output_format and config.output_format.upper() == "JPEG":
        save_kwargs["quality"] = config.jpeg_quality
        save_kwargs["subsampling"] = 0
        save_kwargs["optimize"] = True
    if icc_profile_bytes:
        save_kwargs["icc_profile"] = icc_profile_bytes
    # Embed DPI metadata to ensure PDF tools correctly interpret the image resolution.
    # This is critical for DriveThruCards where the target DPI must be 300.
    if config.embed_dpi_metadata and config.target_pixel_size:
        # Calculate DPI from target pixel size and DTC card dimensions
        target_width, target_height = config.target_pixel_size
        dpi_x = round(target_width / (DTC_CARD_WIDTH_MM / MM_PER_INCH))
        dpi_y = round(target_height / (DTC_CARD_HEIGHT_MM / MM_PER_INCH))
        save_kwargs["dpi"] = (dpi_x, dpi_y)
    return save_kwargs
