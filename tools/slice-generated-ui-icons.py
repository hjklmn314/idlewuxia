from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "generated-ui" / "ui_icon_sheet_alpha.png"
OUT_DIR = ROOT / "public" / "generated-ui" / "icons"

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


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    cols = 4
    rows = 2
    cell_w = image.width // cols
    cell_h = image.height // rows
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    saved = []
    for index, name in enumerate(ICON_NAMES):
        col = index % cols
        row = index // cols
        cell = image.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        bbox = cell.getchannel("A").getbbox()
        if not bbox:
            continue

        pad = 18
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(cell_w, bbox[2] + pad)
        y1 = min(cell_h, bbox[3] + pad)
        crop = cell.crop((x0, y0, x1, y1))

        canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        scale = min(218 / crop.width, 218 / crop.height)
        size = (max(1, int(crop.width * scale)), max(1, int(crop.height * scale)))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        canvas.alpha_composite(resized, ((256 - size[0]) // 2, (256 - size[1]) // 2))

        path = OUT_DIR / f"{name}.png"
        canvas.save(path)
        saved.append(path)

    print(f"source={SOURCE}")
    print(f"size={image.width}x{image.height}")
    print(f"saved={len(saved)}")
    for path in saved:
        print(path)


if __name__ == "__main__":
    main()
