from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "generated-ui" / "single-alpha-v2"
OUT_DIR = ROOT / "public" / "generated-ui" / "icons-v2"
CONTACT_SHEET = ROOT / "public" / "generated-ui" / "icons-v2-contact-sheet.png"

ICON_NAMES = [
    "rail-settings",
    "rail-stats",
    "rail-achievements",
    "rail-store",
    "rail-missions",
    "skill-storm",
    "skill-dot-rain",
    "skill-golden-dot",
]


def normalize_icon(name: str) -> Path:
    image = Image.open(SOURCE_DIR / f"{name}.png").convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"No alpha subject found for {name}")

    pad = 24
    x0 = max(0, bbox[0] - pad)
    y0 = max(0, bbox[1] - pad)
    x1 = min(image.width, bbox[2] + pad)
    y1 = min(image.height, bbox[3] + pad)
    crop = image.crop((x0, y0, x1, y1))

    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    max_size = 218 if name.startswith("skill-") else 224
    scale = min(max_size / crop.width, max_size / crop.height)
    size = (max(1, int(crop.width * scale)), max(1, int(crop.height * scale)))
    resized = crop.resize(size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((256 - size[0]) // 2, (256 - size[1]) // 2))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.png"
    canvas.save(path)
    return path


def build_contact_sheet(paths: list[Path]) -> None:
    cell = 180
    gap = 18
    cols = 4
    rows = 2
    width = cols * cell + (cols + 1) * gap
    height = rows * cell + (rows + 1) * gap
    sheet = Image.new("RGBA", (width, height), (8, 14, 24, 255))
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(paths):
        icon = Image.open(path).convert("RGBA").resize((132, 132), Image.Resampling.LANCZOS)
        col = index % cols
        row = index // cols
        x = gap + col * (cell + gap)
        y = gap + row * (cell + gap)
        draw.rounded_rectangle((x, y, x + cell, y + cell), radius=18, fill=(18, 31, 52, 255), outline=(64, 90, 130, 255), width=2)
        sheet.alpha_composite(icon, (x + (cell - 132) // 2, y + 18))
        draw.text((x + 10, y + cell - 28), path.stem, fill=(210, 225, 245, 255))

    sheet.save(CONTACT_SHEET)


def main() -> None:
    paths = [normalize_icon(name) for name in ICON_NAMES]
    build_contact_sheet(paths)
    print(f"source={SOURCE_DIR}")
    print(f"saved={len(paths)}")
    for path in paths:
        print(path)
    print(f"contact_sheet={CONTACT_SHEET}")


if __name__ == "__main__":
    main()
