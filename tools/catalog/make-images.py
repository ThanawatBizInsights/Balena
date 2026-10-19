"""JPG copies of the product originals for the Meta catalog (image_link needs JPG/GIF/PNG,
at least 500 x 500). Transparent cutouts are placed on white; nothing is cropped or resized.

    python3 tools/catalog/make-images.py   # writes public/catalog/<slug>.jpg
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/products-original"
OUT = ROOT / "public/catalog"

# slug -> original file (same mapping as docs/TRIAL.md)
FILES = {
    "cold-brew-concentrate-smooth-black": "Balena Cold Brew Spout Pouch.png",
    "cold-brew-coffee-original": "ChatGPT Image Sep 15, 2026, 12_52_34 PM (1).png",
    "brazil-santos": "Brasil Santos.png",
    "brazil-cerrado": "Brasil Cerrado.png",
    "laos-bolaven": "Laos Bolaven.png",
    "house-blends": "House Blends.png",
    "kenya-muranga": "Kenya.png",
    "milk-choc": "Milk Choc.png",
    "vino-rosso": "Vino Rosso.png",
    "52hz-signature-blend": "52 Hz.png",
    "blue-magic": "Blue Magic.png",
    "whiskey": "Whiskey.png",
}

OUT.mkdir(parents=True, exist_ok=True)
for slug, name in FILES.items():
    im = Image.open(SRC / name).convert("RGBA")
    flat = Image.new("RGB", im.size, (255, 255, 255))
    flat.paste(im, mask=im.getchannel("A"))
    assert min(flat.size) >= 500, (slug, flat.size)
    flat.save(OUT / f"{slug}.jpg", "JPEG", quality=86, optimize=True, progressive=True)
    print(f"{slug}.jpg {flat.size[0]}x{flat.size[1]}")
