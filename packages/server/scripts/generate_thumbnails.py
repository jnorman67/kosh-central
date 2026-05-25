#!/usr/bin/env python3
"""
generate_thumbnails.py
Backfills thumbnail64 (64×64 base64 PNG) into every bundle JSON sidecar in a
folder tree.  Safe to re-run — already-filled entries are skipped.

Requirements:
    pip install Pillow

Usage:
    # Process one folder (non-recursive):
    python generate_thumbnails.py /path/to/album-folder

    # Process a folder and all subfolders:
    python generate_thumbnails.py /path/to/album-folder --recursive

    # Default: process the folder this script lives in
    python generate_thumbnails.py
"""

import argparse
import base64
import io
import json
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow not found.  Run:  pip install Pillow")

THUMB_SIZE = (64, 64)

# Folder names (case-insensitive) that are silently skipped.
# Must stay in sync with SKIP_FOLDER_NAMES in scan-local.ts and the
# folder-skip rules in docs/photo-metadata-schema.md.
SKIP_FOLDER_NAMES = {"archive", "archived", "ignore", "ignored", "pages"}

# JSON files that are never bundle sidecars.
SKIP_JSON_FILES = {"kosh-manifest.json"}


def make_thumbnail_b64(image_path: str) -> str:
    """
    Open an image (respecting EXIF rotation), shrink to fit within 64×64,
    paste onto a white 64×64 canvas, and return as a base64-encoded PNG string.
    """
    with Image.open(image_path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        canvas = Image.new("RGB", THUMB_SIZE, (255, 255, 255))
        offset = (
            (THUMB_SIZE[0] - img.width) // 2,
            (THUMB_SIZE[1] - img.height) // 2,
        )
        canvas.paste(img, offset)
        buf = io.BytesIO()
        canvas.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")


def process_folder(folder: str, changed: list, errors: list) -> None:
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json") or name in SKIP_JSON_FILES:
            continue
        json_path = os.path.join(folder, name)
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            errors.append(f"  SKIP (bad JSON): {json_path}: {e}")
            continue

        if "files" not in data:
            continue

        dirty = False
        for entry in data["files"]:
            if entry.get("thumbnail64") is not None:
                continue  # already filled — skip
            img_name = entry.get("fileName", "")
            img_path = os.path.join(folder, img_name)
            if not os.path.isfile(img_path):
                errors.append(f"  MISSING image: {img_path}")
                continue
            try:
                entry["thumbnail64"] = make_thumbnail_b64(img_path)
                dirty = True
                print(f"  ✓ {img_name}")
            except Exception as e:
                errors.append(f"  ERROR thumbnailing {img_path}: {e}")

        if dirty:
            data.pop("thumbnail_note", None)  # clean up legacy placeholder
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            changed.append(json_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill thumbnail64 into bundle JSON sidecars."
    )
    parser.add_argument(
        "folder",
        nargs="?",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Root folder to process (default: script location)",
    )
    parser.add_argument(
        "--recursive", "-r",
        action="store_true",
        help="Also descend into subfolders (skipping archive/pages/etc.)",
    )
    args = parser.parse_args()

    root = os.path.abspath(args.folder)
    changed: list[str] = []
    errors: list[str] = []

    print(f"Processing: {root}")
    process_folder(root, changed, errors)

    if args.recursive:
        for dirpath, dirnames, _ in os.walk(root):
            if dirpath == root:
                continue
            # Prune skip folders in-place so os.walk won't descend into them.
            dirnames[:] = [
                d for d in dirnames
                if d.lower() not in SKIP_FOLDER_NAMES
            ]
            print(f"Processing: {dirpath}")
            process_folder(dirpath, changed, errors)

    print(f"\nDone.  {len(changed)} JSON(s) updated.")
    if errors:
        print(f"\nWarnings / errors ({len(errors)}):")
        for msg in errors:
            print(msg)


if __name__ == "__main__":
    main()
