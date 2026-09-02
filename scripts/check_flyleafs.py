#!/usr/bin/env python3
"""Check the visible content, geometry, and bookmarks of every archive flyleaf."""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ContentStream


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
    root = reader.root_object
    page = reader.pages[0]
    info = reader.metadata or {}
    text = compact(page.extract_text())
    title = compact(info.get("/Title"))
    author = compact(info.get("/Author"))
    url = compact(info.get("/Permalink"))
    errors = []

    mark_info = root.get("/MarkInfo") or {}
    if hasattr(mark_info, "get_object"):
        mark_info = mark_info.get_object()
    struct_root = root.get("/StructTreeRoot")
    parent_tree_keys: set[int] = set()
    if not struct_root or not mark_info.get("/Marked"):
        errors.append("document is not tagged")
    else:
        struct_root = struct_root.get_object()
        parent_tree = struct_root.get("/ParentTree").get_object()
        numbers = parent_tree.get("/Nums") or []
        keys = [int(numbers[index]) for index in range(0, len(numbers), 2)]
        parent_tree_keys = set(keys)
        if keys != sorted(keys) or len(keys) != len(set(keys)):
            errors.append("structure parent tree keys are not sorted and unique")
    for number, current_page in enumerate(reader.pages, 1):
        marks = []
        seen_mcid = False
        for operands, operator in ContentStream(current_page.get_contents(), reader).operations:
            if operator in (b"BMC", b"BDC"):
                kind = "artifact" if operands and operands[0] == "/Artifact" else "mcid" if operator == b"BDC" and len(operands) > 1 and "/MCID" in operands[1] else "other"
                if kind == "artifact" and "mcid" in marks or kind == "mcid" and any(item in marks for item in ("artifact", "mcid")):
                    errors.append(f"page {number} has nested tagged/artifact content")
                seen_mcid |= kind == "mcid"
                marks.append(kind)
            elif operator == b"EMC" and marks:
                marks.pop()
        if not seen_mcid:
            errors.append(f"page {number} has no tagged content")
        annotations = current_page.get("/Annots") or []
        if annotations and current_page.get("/Tabs") != "/S":
            errors.append(f"page {number} annotation tab order is not structural")
        for annotation_ref in annotations:
            annotation = annotation_ref.get_object()
            # An annotation must be reachable from the structure tree or Acrobat's
            # "Tagged annotations" check fails it. This used to assert the opposite --
            # that /StructParent was absent -- which kept the tree clean of dangling
            # references at the cost of leaving every link untagged. Require the key,
            # and require it to resolve.
            struct_parent = annotation.get("/StructParent")
            if struct_parent is None:
                errors.append(f"page {number} has an untagged annotation")
            elif int(struct_parent) not in parent_tree_keys:
                errors.append(f"page {number} has a dangling annotation structure reference")
            if annotation.get("/Subtype") == "/Link" and not annotation.get("/Contents"):
                errors.append(f"page {number} has an undescribed link")

    for label, value in (("title", title), ("URL", url)):
        if not value or fold(value) not in fold(text):
            errors.append(f"visible {label} does not match metadata")
    visible_author = ", ".join(part.strip() for part in author.split(";") if part.strip())
    if author and fold(visible_author) not in fold(text):
        errors.append("visible author does not match metadata")
    # ponytail: accepts either notice until the jcrt-meta flyleaf template emits the CC BY
    # line; then require the CC line for PDFs dated >= 2026-08-24 (see check_pdf_rights.py).
    if not any(n in text for n in ("Copyright © held by the author(s). All rights reserved.", "Creative Commons Attribution 4.0")):
        errors.append("copyright notice missing")

    data = page.get_contents().get_data().decode("latin-1")
    decorative_logos = re.findall(r"/Artifact\s+BMC(?:(?!EMC).)*?/\S+\s+Do(?:(?!EMC).)*?EMC", data, re.S)
    if len(decorative_logos) != 2:
        errors.append(f"expected 2 decorative logos, found {len(decorative_logos)}")
    logo = re.search(r"\b48(?:\.0+)? 0 0 48(?:\.0+)? 54(?:\.0+)? ([\d.]+) cm\s*/\S+ Do", data)
    lines = re.findall(r"\bn\s+([\d.]+) ([\d.]+) m\s+([\d.]+) ([\d.]+) l\s+S", data)
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
