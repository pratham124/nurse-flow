"""Render NurseFlow's app icon, splash, and logo PNGs from assets/images/nurseflow-mark.svg.

Run from the repo root on Windows:  python scripts/render-brand-assets.py
Needs Google Chrome (headless, to rasterize the SVG) and Pillow.
"""
import pathlib
import subprocess
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
# The drawing's bounding box inside the SVG's 1024x1024 viewBox.
MARK_BOX = (178, 166, 846, 874)


def render_page(html: str, width: int, height: int) -> Image.Image:
    """Screenshot an HTML page with a transparent background."""
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "page.html"
        shot = pathlib.Path(tmp) / "shot.png"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
             "--default-background-color=00000000", f"--window-size={width},{height}",
             f"--screenshot={shot}", page.as_uri()],
            check=True, capture_output=True,
        )
        return Image.open(shot).convert("RGBA")


def render_mark(size: int) -> Image.Image:
    """The mark cropped to its drawing, scaled to fit a size x size square."""
    svg_uri = (IMAGES / "nurseflow-mark.svg").as_uri()
    full = render_page(
        f'<html><body style="margin:0"><img src="{svg_uri}" width="2048" height="2048"></body></html>',
        2048, 2048)
    box = tuple(v * 2 for v in MARK_BOX)
    cropped = full.crop(box)
    cropped.thumbnail((size, size), Image.LANCZOS)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    square.alpha_composite(cropped, ((size - cropped.width) // 2, (size - cropped.height) // 2))
    return square


def place(mark_size: int, canvas: int, background=None) -> Image.Image:
    image = Image.new("RGBA", (canvas, canvas), background or (0, 0, 0, 0))
    offset = (canvas - mark_size) // 2
    image.alpha_composite(render_mark(mark_size), (offset, offset))
    return image


def main() -> None:
    # iOS icon: opaque, square; iOS rounds the corners itself.
    place(860, 1024, (255, 255, 255, 255)).convert("RGB").save(IMAGES / "icon.png")
    # Splash image (shown at 200 pt wide on a white background).
    place(1024, 1024).save(IMAGES / "splash-icon.png")
    # Android adaptive icon: keep the drawing inside the central safe zone.
    place(330, 512).save(IMAGES / "android-icon-foreground.png")
    mono = place(280, 432)
    alpha = mono.getchannel("A")
    white = Image.new("RGBA", mono.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    white.save(IMAGES / "android-icon-monochrome.png")
    place(44, 48).save(IMAGES / "favicon.png")
    # In-app mark (shown at 38x44 pt; rendered at 3x).
    render_mark(132).save(IMAGES / "nurseflow-mark.png")
    # Wordmark for the sign-in screen (shown at 160x122 pt; rendered at 3x).
    mark_uri = (IMAGES / "nurseflow-mark.svg").as_uri()
    wordmark = render_page(
        '<html><body style="margin:0;width:480px;height:366px;display:flex;'
        'flex-direction:column;align-items:center;justify-content:center">'
        f'<div style="width:250px;height:262px;overflow:hidden;position:relative">'
        f'<img src="{mark_uri}" style="position:absolute;left:-66px;top:-62px;width:372px;height:372px"></div>'
        '<div style="font:900 50px \'Arial Black\',\'Segoe UI\',sans-serif;letter-spacing:2px;'
        'color:#141012;margin-top:12px;line-height:1;white-space:nowrap">NURSE FLOW</div></body></html>',
        480, 366)
    wordmark.save(IMAGES / "nurseflow-logo.png")


if __name__ == "__main__":
    main()
