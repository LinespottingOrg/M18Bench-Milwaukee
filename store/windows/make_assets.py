"""Store tiles for M18 Bench. Same mark as the bench header, no Milwaukee branding."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "Assets"
BG = (20, 18, 16, 255)
CREAM = (243, 238, 230, 255)
RED = (225, 6, 0, 255)
MUTED = (167, 156, 144, 255)
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

# viewBox 32 bars: x, y, w, h, color
BARS = [
    (5, 9, 3, 14, CREAM),
    (10, 7, 3, 18, CREAM),
    (15, 5, 3, 22, RED),
    (20, 7, 3, 18, CREAM),
    (25, 9, 3, 14, CREAM),
]


def mark(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)
    scale = size / 32
    for x, y, w, h, color in BARS:
        draw.rectangle([x * scale, y * scale, (x + w) * scale - 1, (y + h) * scale - 1], fill=color)
    return image


def wide(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, width, max(2, height // 75)], fill=RED)
    tile = mark(int(height * 0.62))
    pad = int(height * 0.14)
    image.alpha_composite(tile, (pad, (height - tile.height) // 2))
    title_size = int(height * 0.30)
    sub_size = int(height * 0.12)
    title = ImageFont.truetype(BOLD, title_size)
    sub = ImageFont.truetype(REG, sub_size)
    text_x = pad + tile.width + int(height * 0.10)
    title_w = draw.textlength("M18", font=title)
    while text_x + title_w > width - pad and title_size > 12:
        title_size -= 2
        title = ImageFont.truetype(BOLD, title_size)
        title_w = draw.textlength("M18", font=title)
    draw.text((text_x, int(height * 0.26)), "M18", font=title, fill=CREAM)
    draw.text((text_x, int(height * 0.60)), "BENCH", font=sub, fill=MUTED)
    return image


def save(image: Image.Image, name: str) -> None:
    path = ASSETS / name
    image.convert("RGBA").save(path, "PNG")
    print(path.name, image.size)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    save(mark(50), "StoreLogo.png")
    save(mark(100), "StoreLogo.scale-200.png")
    save(mark(44), "Square44x44Logo.png")
    for target in (16, 24, 32, 48, 256):
        save(mark(target), f"Square44x44Logo.targetsize-{target}.png")
    save(mark(150), "Square150x150Logo.png")
    save(mark(310), "Square310x310Logo.png")
    save(wide(310, 150), "Wide310x150Logo.png")
    save(wide(620, 300), "SplashScreen.png")


if __name__ == "__main__":
    main()
