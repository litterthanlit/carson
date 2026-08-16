#!/usr/bin/env python3
"""Resize Nick's texture library into public/textures and write a catalog.

Commercial packs stay local — full/thumb rasters are gitignored.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True
Image.MAX_IMAGE_PIXELS = 200_000_000

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(
    "/Users/niki_g/Desktop/Projects/1 : design/TEXTUTRES : TOOLS/textures"
)
FULL_DIR = ROOT / "public" / "textures" / "full"
THUMB_DIR = ROOT / "public" / "textures" / "thumbs"
CATALOG_TS = ROOT / "src" / "lib" / "textureCatalog.generated.ts"
CATALOG_JSON = ROOT / "public" / "textures" / "catalog.json"

FULL_SIZE = 2048
THUMB_SIZE = 180
JPEG_QUALITY = 82
THUMB_QUALITY = 72

RASTER_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}
SKIP_DIR_NAMES = {"originals"}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "texture"


def has_useful_alpha(image: Image.Image) -> bool:
    if image.mode in {"RGBA", "LA"}:
        extrema = image.getchannel("A").getextrema()
        return bool(extrema and extrema[0] < 250)
    if image.mode == "P" and "transparency" in image.info:
        return True
    return False


def categorize(relative: Path, filename: str) -> str:
    haystack = f"{relative.as_posix()} {filename}".lower()
    if "papercut" in haystack or "paper" in haystack:
        return "paper"
    if "inked design syndrome" in haystack or "inkpaint" in haystack:
        return "ink"
    if re.fullmatch(r"\d+\.png", filename.lower()):
        return "print"
    if "grunge" in haystack:
        return "grunge"
    if "lensfx" in haystack or "lens" in haystack:
        return "lens"
    if "photocop" in haystack or "studioaaa" in haystack:
        return "photocopy"
    if "concrete" in haystack:
        return "surface"
    return "found"


def display_name(relative: Path, filename: str, category: str) -> str:
    stem = Path(filename).stem
    if re.fullmatch(r"\d+", stem):
        return f"Print {int(stem)}"
    match = re.search(r"TEXTURE\s+(\d+)$", stem, re.I)
    if match and "inked" in stem.lower():
        return f"Ink {int(match.group(1))}"
    match = re.search(r"TRANSPARENT(\d+)$", stem, re.I)
    if match:
        return f"Papercut {int(match.group(1))}"
    match = re.search(r"(Grunge|Concrete|InkPaint|LensFX)[_-]?(\d+)", stem, re.I)
    if match:
        return f"{match.group(1).title()} {match.group(2)}"
    match = re.search(r"(Paper Texture|Grunge Texture)\s+(\d+)", stem, re.I)
    if match:
        return f"{match.group(1)} {match.group(2)}"
    if (
        re.fullmatch(r"[A-Za-z0-9_-]{10,}", stem)
        and re.search(r"\d", stem)
        and re.search(r"[A-Z]", stem)
        and "texture" not in stem.lower()
    ):
        return "Found scan"
    cleaned = re.sub(r"[_-]+", " ", stem).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if len(cleaned) > 42:
        cleaned = cleaned[:39].rstrip() + "…"
    return cleaned or category.title()


def defaults_for(category: str, alpha: bool) -> tuple[str, float]:
    if alpha:
        return "source-over", 1
    if category == "lens":
        return "screen", 0.72
    if category == "found":
        return "screen", 0.55
    if category == "paper":
        return "multiply", 0.62
    if category == "surface":
        return "overlay", 0.58
    return "multiply", 0.55


def iter_source_files(source: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in RASTER_EXTS:
            continue
        if any(part.lower() in SKIP_DIR_NAMES for part in path.parts):
            continue
        if path.name.startswith("."):
            continue
        files.append(path)
    return files


def unique_id(used: set[str], *parts: str) -> str:
    base = slugify("-".join(part for part in parts if part))
    candidate = base
    index = 2
    while candidate in used:
        candidate = f"{base}-{index}"
        index += 1
    used.add(candidate)
    return candidate


def fit_copy(image: Image.Image, max_size: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return copy


def to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in {"RGB", "L"}:
        return image.convert("RGB")
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, (12, 12, 12))
        rgba = image.convert("RGBA")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def save_image(image: Image.Image, dest: Path, keep_alpha: bool) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if keep_alpha:
        image.convert("RGBA").save(dest.with_suffix(".png"), optimize=True)
        return ".png"
    to_rgb(image).save(
        dest.with_suffix(".jpg"),
        "JPEG",
        quality=JPEG_QUALITY if dest.parent.name == "full" else THUMB_QUALITY,
        optimize=True,
        progressive=True,
    )
    return ".jpg"


def write_catalog(assets: list[dict]) -> None:
    CATALOG_JSON.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_JSON.write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")
    lines = [
        "/* Generated by scripts/import-textures.py — do not edit by hand. */",
        "export const TEXTURE_ASSETS = [",
    ]
    for asset in assets:
        lines.append("  {")
        for key, value in asset.items():
            lines.append(f"    {key}: {json.dumps(value)},")
        lines.append("  },")
    lines.append("] as const")
    lines.append("")
    CATALOG_TS.write_text("\n".join(lines), encoding="utf-8")


def import_textures(source: Path) -> int:
    if not source.is_dir():
        print(f"Source folder not found: {source}", file=sys.stderr)
        return 1

    FULL_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    files = iter_source_files(source)
    used_ids: set[str] = set()
    assets: list[dict] = []

    print(f"Importing {len(files)} textures from {source}")
    for index, path in enumerate(files, start=1):
        relative = path.relative_to(source)
        category = categorize(relative, path.name)
        asset_id = unique_id(used_ids, category, Path(path.name).stem)
        name = display_name(relative, path.name, category)

        try:
            with Image.open(path) as original:
                original.load()
                alpha = has_useful_alpha(original)
                full = fit_copy(original, FULL_SIZE)
                thumb = fit_copy(original, THUMB_SIZE)
        except Exception as error:  # noqa: BLE001 — keep the rest of the library
            print(f"  skip {relative}: {error}")
            continue

        ext = save_image(full, FULL_DIR / asset_id, alpha)
        save_image(thumb, THUMB_DIR / asset_id, False)
        full.close()
        thumb.close()

        blend, opacity = defaults_for(category, alpha)
        assets.append(
            {
                "id": asset_id,
                "name": name,
                "category": category,
                "src": f"textures/full/{asset_id}{ext}",
                "thumb": f"textures/thumbs/{asset_id}.jpg",
                "hasAlpha": alpha,
                "defaultBlend": blend,
                "defaultOpacity": opacity,
            }
        )
        print(f"  [{index}/{len(files)}] {name} ({category})")

    found_index = 1
    for asset in assets:
        if asset["name"] == "Found scan":
            asset["name"] = f"Found {found_index:02d}"
            found_index += 1

    assets.sort(key=lambda item: (item["category"], item["name"]))
    write_catalog(assets)
    print(f"Wrote {len(assets)} textures → {CATALOG_TS}")
    return 0


if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    raise SystemExit(import_textures(source))
