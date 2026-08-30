#!/usr/bin/env python3
"""Check the visible content, geometry, and bookmarks of every archive flyleaf."""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


def compact(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def fold(value: object) -> str:
    text = unicodedata.normalize("NFKD", compact(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def bookmarks(reader: PdfReader):
    for item in reader.outline:
        if isinstance(item, list):
            continue
        yield compact(getattr(item, "title", "")), reader.get_destination_page_number(item)


def check(path: Path) -> list[str]:
    reader = PdfReader(path)
    page = reader.pages[0]
    info = reader.metadata or {}
    text = compact(page.extract_text())
    title = compact(info.get("/Title"))
    author = compact(info.get("/Author"))
    url = compact(info.get("/Permalink"))
    errors = []

    for label, value in (("title", title), ("URL", url)):
        if not value or fold(value) not in fold(text):
            errors.append(f"visible {label} does not match metadata")
    visible_author = ", ".join(part.strip() for part in author.split(";") if part.strip())
    if author and fold(visible_author) not in fold(text):
        errors.append("visible author does not match metadata")
    if "Copyright © held by the author(s). All rights reserved." not in text:
        errors.append("copyright notice missing")

    data = page.get_contents().get_data().decode("latin-1")
    logo = re.search(r"\b48(?:\.0+)? 0 0 48(?:\.0+)? 54(?:\.0+)? ([\d.]+) cm\s*/\S+ Do", data)
    lines = re.findall(r"\bn ([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S", data)
    width = float(page.mediabox.width)
    header = next((tuple(map(float, line)) for line in lines if float(line[1]) > float(page.mediabox.height) / 2), None)
    if not logo or not header:
        errors.append("logo or header rule missing")
    else:
        logo_bottom = float(logo.group(1))
        x1, y1, x2, y2 = header
        if any(abs(actual - expected) > 0.05 for actual, expected in ((x1, 54), (x2, width - 54), (y1, y2), (y1, logo_bottom - 1))):
            errors.append("logo and header rule are misaligned")

    marks = list(bookmarks(reader))
    if marks != [("Flyleaf", 0), (title, 1)]:
        errors.append(f"bookmarks are {marks!r}")
    return errors


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "archives")
    pdfs = sorted(root.glob("*/*.pdf"))
    failures = [(path, check(path)) for path in pdfs]
    failures = [(path, errors) for path, errors in failures if errors]
    for path, errors in failures:
        print(f"{path}: {'; '.join(errors)}", file=sys.stderr)
    print(f"checked {len(pdfs)} flyleafs; {len(failures)} failed")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
