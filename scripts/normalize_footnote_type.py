#!/usr/bin/env python3
"""Reset footnote and page-number type to Book Antiqua 8.5pt.

Archive PDFs arrive from many authors' word processors, so their footnote and
folio type is inconsistent: Times New Roman, Arial, Calibri, Aptos, Liberation
Serif and Carlito all appear, at sizes from 6.0 to 12.0. This rewrites those
runs in Book Antiqua at 8.5pt, the house setting.

Scope is deliberately narrow. Only two regions are touched:

  * footnotes -- everything below the footnote separator rule, found by looking
    for a short horizontal rule in the lower half of the page;
  * page numbers -- a bare numeral sitting in the top or bottom margin.

Body text, headings, running heads and the flyleaf are left alone.

Three rules keep the rewrite from destroying anything:

  * A line containing any character Book Antiqua cannot set is skipped whole,
    keeping its original typography. Better a line that stays inconsistent than
    one that loses its diacritics. --report lists them.
  * Superscript runs (raised baseline, smaller than the rest of their line) keep
    their size *ratio* rather than being flattened to 8.5, so footnote reference
    numerals stay superscript.
  * If a line will not fit its column at 8.5 the whole line is scaled down until
    it does, never below MIN_SIZE.

Redaction rewrites the content stream, so marked content is lost and the file
must be re-tagged afterwards. Run this before any tagging or outline pass.

Usage:
  python3 scripts/normalize_footnote_type.py --report archives/25.2/*.pdf
  python3 scripts/normalize_footnote_type.py --write  archives/25.2/*.pdf
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

TARGET_SIZE = 8.5
MIN_SIZE = 6.0
# Below this the run is treated as superscript rather than undersized body text.
SUPERSCRIPT_RATIO = 0.85
SUPERSCRIPT_RISE = 0.5

BARE_NUMERAL = re.compile(r"^[\s ]*\d{1,4}[\s ]*$")

FACES = {
    ("regular"): ("BAnt", "BookAntiqua.ttf"),
    ("italic"): ("BAntI", "BookAntiquaItalic.ttf"),
    ("bold"): ("BAntB", "BookAntiquaBold.ttf"),
    ("bolditalic"): ("BAntBI", "BookAntiquaBoldItalic.ttf"),
}


def face_key(font_name: str, flags: int) -> str:
    """Pick a Book Antiqua face from the original span's font name and flags."""
    lowered = font_name.lower()
    italic = "italic" in lowered or "oblique" in lowered or bool(flags & 2)
    bold = "bold" in lowered or "black" in lowered or "heavy" in lowered or bool(flags & 16)
    if bold and italic:
        return "bolditalic"
    if bold:
        return "bold"
    if italic:
        return "italic"
    return "regular"


class Faces:
    """The four Book Antiqua faces, loaded once and reused across files."""

    def __init__(self, font_dir: Path):
        self.font_dir = font_dir
        self.fonts = {key: fitz.Font(fontfile=str(font_dir / filename))
                      for key, (_, filename) in FACES.items()}

    def alias(self, key: str) -> str:
        return FACES[key][0]

    def path(self, key: str) -> str:
        return str(self.font_dir / FACES[key][1])

    def can_set(self, text: str) -> bool:
        font = self.fonts["regular"]
        return all(font.has_glyph(ord(ch)) for ch in text if ch.strip())

    def width(self, key: str, text: str, size: float) -> float:
        return self.fonts[key].text_length(text, fontsize=size)


def link_key(link) -> tuple:
    return (link.get("uri"), link.get("page", -1), tuple(round(v, 1) for v in link["from"]))


def snapshot_links(page) -> list[tuple[dict, str | None]]:
    """Record this page's links plus their /Contents alt text.

    apply_redactions() deletes every annotation a redaction box touches, which in
    footnote territory is most of the citation links. get_links() does not carry
    /Contents, so the alt text is fetched separately and put back by hand -- losing
    it would undo the annotation tagging these files need.
    """
    doc = page.parent
    recorded = []
    for link in page.get_links():
        contents = None
        xref = link.get("xref", 0)
        if xref:
            kind, value = doc.xref_get_key(xref, "Contents")
            if kind not in (None, "null"):
                contents = value
        recorded.append((link, contents))
    return recorded


def restore_links(page, recorded) -> int:
    """Re-add any recorded link the redaction removed. Returns how many came back."""
    doc = page.parent
    present = {link_key(link) for link in page.get_links()}
    restored = 0
    for link, contents in recorded:
        if link_key(link) in present:
            continue
        page.insert_link(link)
        if contents:
            links = page.get_links()
            if links and links[-1].get("xref"):
                doc.xref_set_key(links[-1]["xref"], "Contents", contents)
        restored += 1
    return restored


def footnote_cut(page) -> float | None:
    """The y of the footnote separator rule, or None if the page has no footnotes."""
    height = page.rect.height
    rules = [d["rect"].y0 for d in page.get_drawings()
             if d["rect"].height < 3
             and 40 < d["rect"].width < 0.5 * page.rect.width
             and d["rect"].y0 > height * 0.45]
    return max(rules) if rules else None


def column_right(page) -> float:
    """Right edge of the page's text column, used as the wrap limit."""
    edges = [line["bbox"][2] for block in page.get_text("dict")["blocks"]
             for line in block.get("lines", [])]
    return max(edges) if edges else page.rect.width - 54


def target_lines(page):
    """Yield (line, kind) for every footnote or page-number line on the page."""
    height = page.rect.height
    cut = footnote_cut(page)
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"])
            if not text.strip():
                continue
            top, bottom = line["bbox"][1], line["bbox"][3]
            middle = (top + bottom) / 2
            if BARE_NUMERAL.match(text) and (top < height * 0.09 or top > height * 0.90):
                yield line, "folio"
            elif cut is not None and middle >= cut:
                # Midpoint, not top: the first footnote line sits tight against the
                # separator rule and its box often starts a hair above it.
                yield line, "footnote"


def plan_line(line, faces: Faces, right_limit: float):
    """Work out the replacement runs for one line, or None to leave it alone.

    Returns (runs, scale) where each run is (origin, text, face_key, size, color).
    """
    # Every span is kept, including whitespace-only ones: they carry the inter-word
    # gaps, and dropping them runs the neighbouring words together.
    spans = line["spans"]
    text = "".join(s["text"] for s in spans)
    if not text.strip() or not faces.can_set(text):
        return None

    # The line's dominant size is the one covering the most characters; superscripts
    # are measured against it rather than against a fixed threshold.
    weighted = Counter()
    for span in spans:
        if span["text"].strip():
            weighted[round(span["size"], 1)] += len(span["text"])
    dominant = weighted.most_common(1)[0][0]
    baseline = max(span["origin"][1] for span in spans)

    runs = []
    for span in spans:
        key = face_key(span["font"], span.get("flags", 0))
        raised = baseline - span["origin"][1] > SUPERSCRIPT_RISE
        smaller = span["size"] < dominant * SUPERSCRIPT_RATIO
        if raised and smaller:
            size = max(MIN_SIZE, round(TARGET_SIZE * span["size"] / dominant, 2))
        else:
            size = TARGET_SIZE
        runs.append([span["origin"][1], span["text"], key, size, span["color"]])

    # Shrink the whole line if it would overrun its column at these sizes.
    start_x = spans[0]["origin"][0]
    natural = sum(faces.width(key, txt, size) for _, txt, key, size, _ in runs)
    available = right_limit - start_x
    scale = 1.0
    if natural > available > 0:
        scale = max(MIN_SIZE / TARGET_SIZE, available / natural)
        for run in runs:
            run[3] = max(MIN_SIZE, round(run[3] * scale, 2))

    # Lay the runs out left to right from the line's own start. Reusing each span's
    # original x would leave the old advances in place, so a run set at a new size
    # would overlap or gap against its neighbour.
    placed = []
    x = start_x
    for y, txt, key, size, color in runs:
        placed.append((fitz.Point(x, y), txt, key, size, color))
        x += faces.width(key, txt, size)
    return placed, scale


def already_house_style(line) -> bool:
    spans = [s for s in line["spans"] if s["text"].strip()]
    return bool(spans) and all(
        s["font"].startswith("BookAntiqua") and abs(s["size"] - TARGET_SIZE) < 0.05
        for s in spans
    )


def process(path: Path, faces: Faces, write: bool) -> dict:
    stats = Counter()
    skipped = []
    timestamps = path.stat()
    doc = fitz.open(path)
    for number in range(1, doc.page_count):          # page 0 is the flyleaf
        page = doc[number]
        right_limit = column_right(page)
        all_boxes = [fitz.Rect(line["bbox"])
                     for block in page.get_text("dict")["blocks"]
                     for line in block.get("lines", [])]
        work = []
        for line, kind in target_lines(page):
            if already_house_style(line):
                stats["already"] += 1
                continue
            planned = plan_line(line, faces, right_limit)
            if planned is None:
                stats["skipped"] += 1
                text = "".join(s["text"] for s in line["spans"]).strip()
                skipped.append((number + 1, text[:70]))
                continue
            runs, scale = planned
            stats[kind] += 1
            if scale < 1.0:
                stats["shrunk"] += 1
            work.append((fitz.Rect(line["bbox"]), runs))

        if not work or not write:
            continue

        # A redaction box erases every glyph it touches, so one that reaches a
        # neighbouring line deletes text nothing will redraw. Pull each box back
        # off any line that is not itself being rewritten, and give up on the
        # line entirely if it cannot be separated.
        rewritten = [rect for rect, _ in work]
        protected = [box for box in all_boxes
                     if not any(box.intersects(r) and abs(box.y0 - r.y0) < 0.01 for r in rewritten)]
        safe = []
        for rect, runs in work:
            box = fitz.Rect(rect)
            for other in protected:
                if not box.intersects(other) or other.x1 <= box.x0 or other.x0 >= box.x1:
                    continue
                if other.y1 <= box.y1 and other.y0 < box.y0:      # neighbour above
                    box.y0 = max(box.y0, other.y1)
                elif other.y0 >= box.y0 and other.y1 > box.y1:    # neighbour below
                    box.y1 = min(box.y1, other.y0)
            if box.y1 - box.y0 > 1 and not any(
                box.intersects(other) and other.x1 > box.x0 and other.x0 < box.x1
                for other in protected
            ):
                safe.append((box, runs))
            else:
                stats["unsafe"] += 1
        work = safe
        if not work:
            continue

        recorded = snapshot_links(page)
        for rect, _ in work:
            page.add_redact_annot(rect)
        # Leave images and vector art alone: the footnote separator rule and any
        # figure sitting near a redaction box must survive.
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        stats["links_restored"] += restore_links(page, recorded)
        for _, runs in work:
            for origin, text, key, size, color in runs:
                if not text.strip():
                    continue          # a gap run: it advanced the pen, nothing to draw
                page.insert_text(
                    origin,
                    text,
                    fontname=faces.alias(key),
                    fontfile=faces.path(key),
                    fontsize=size,
                    color=fitz.sRGB_to_pdf(color),
                )

    if write and (stats["footnote"] or stats["folio"]):
        tmp_path = path.with_name(f"{path.stem}.type.tmp.pdf")
        doc.save(tmp_path, garbage=3, deflate=True)
        doc.close()
        tmp_path.replace(path)
        os.utime(path, ns=(timestamps.st_atime_ns, timestamps.st_mtime_ns))
    else:
        doc.close()
    stats["skipped_lines"] = skipped
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--write", action="store_true", help="apply (default: report only)")
    parser.add_argument("--report", action="store_true", help="list the lines that were skipped")
    parser.add_argument("--font-dir", type=Path, required=True,
                        help="directory holding the four BookAntiqua*.ttf faces")
    args = parser.parse_args()

    faces = Faces(args.font_dir)
    totals = Counter()
    for path in args.pdfs:
        stats = process(path, faces, args.write)
        skipped = stats.pop("skipped_lines")
        for key, value in stats.items():
            totals[key] += value
        touched = stats["footnote"] + stats["folio"]
        if touched or stats["skipped"]:
            parts = [f"{stats['footnote']} footnote + {stats['folio']} folio lines "
                     f"{'rewritten' if args.write else 'to rewrite'}"]
            if stats["shrunk"]:
                parts.append(f"{stats['shrunk']} shrunk to fit")
            if stats["skipped"]:
                parts.append(f"{stats['skipped']} skipped")
            parts.append(f"{stats['already']} already correct")
            print(f"{path}: {', '.join(parts)}")
        if args.report and skipped:
            for page_number, text in skipped:
                print(f"    skipped p{page_number}: {text}")
    print(f"\ntotal: {totals['footnote']} footnote lines, {totals['folio']} folio lines, "
          f"{totals['shrunk']} shrunk to fit, {totals['skipped']} skipped, "
          f"{totals['already']} already correct", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
