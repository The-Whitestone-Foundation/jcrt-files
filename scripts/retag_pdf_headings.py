#!/usr/bin/env python3
"""
Retag PDF headings and rebuild outlines for JCRT archive PDFs.

This script uses:
- lxml + pdftohtml -xml for visual heading detection
- pypdf visitor hooks for MCID-aware text extraction
- pikepdf for structure-tree and outline updates
"""

from __future__ import annotations

import argparse
import math
import re
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import pikepdf
from lxml import etree
from pikepdf import Name, OutlineItem
from pypdf import PdfReader

IGNORED_PDFS = {"table-of-contents.pdf", "author-bios.pdf"}
HEADING_TAGS = {"/H", "/H1", "/H2", "/H3"}
BODY_TAGS = {"/P", "/Span"}


@dataclass
class XmlFragment:
    top: int
    left: int
    width: int
    height: int
    text: str
    font_family: str
    italic: bool


@dataclass
class XmlLine:
    page_index: int
    page_width: int
    page_height: int
    top: int
    bottom: int
    left: int
    right: int
    text: str
    fragments: list[XmlFragment]
    center: float
    is_centered: bool
    is_all_caps: bool
    is_full_line_italic: bool
    normalized: str
    y_pdf_estimate: float


@dataclass
class McidPiece:
    mcid: int | None
    tag: str | None
    text: str
    x: float
    y: float
    font: str | None


@dataclass
class PdfLine:
    page_index: int
    text: str
    normalized: str
    y: float
    x_min: float
    mcids: list[int]
    tags: dict[int, str | None]
    texts_by_mcid: dict[int, str]
    fonts_by_mcid: dict[int, set[str]]


@dataclass
class HeadingTarget:
    level: str
    title: str
    page_index: int
    top: float
    xml_line: XmlLine
    pdf_line: PdfLine
    primary_mcids: list[int]
    auxiliary_mcids: list[int] = field(default_factory=list)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_compare(text: str) -> str:
    text = unicodedata.normalize("NFKD", normalize_space(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold()
    text = re.sub(r"[“”\"'`]+", "", text)
    text = re.sub(r"[^0-9a-z]+", "", text)
    return text


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


BIBLIOGRAPHY_HEADINGS = {
    normalize_compare("Bibliography"),
    normalize_compare("References"),
    normalize_compare("Works Cited"),
    normalize_compare("Reference List"),
}


def parse_frontmatter(md_path: Path) -> dict[str, str]:
    text = md_path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}
    block = match.group(1)
    result: dict[str, str] = {}
    for line in block.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        if key not in {"title", "author"}:
            continue
        result[key] = strip_quotes(value.strip())
    return result


def all_caps_text(text: str) -> bool:
    letters = "".join(ch for ch in text if ch.isalpha())
    return bool(letters) and letters == letters.upper()


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    shorter, longer = sorted((a, b), key=len)
    if shorter and shorter in longer:
        return len(shorter) / len(longer)
    common = sum(1 for x, y in zip(a, b) if x == y)
    return common / max(len(a), len(b))


def resembles_title_fragment(text_norm: str, title_norm: str) -> bool:
    if not text_norm or not title_norm:
        return False
    if similarity(text_norm, title_norm) >= 0.7:
        return True
    return len(text_norm) >= 8 and text_norm in title_norm


def xml_bottom_to_pdf_y(bottom: int, xml_height: int, pdf_height: float) -> float:
    return pdf_height - (bottom / xml_height * pdf_height)


def is_italic_family(font_family: str) -> bool:
    lower = font_family.casefold()
    return "italic" in lower or lower.endswith("it") or "-it" in lower


def build_xml_lines(pdf_path: Path, pdf_reader: PdfReader) -> dict[int, list[XmlLine]]:
    with tempfile.TemporaryDirectory(prefix=f"{pdf_path.stem}-xml-") as temp_dir:
        xml_path = Path(temp_dir) / "layout.xml"
        subprocess.run(
            ["pdftohtml", "-xml", str(pdf_path), str(xml_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        root = etree.parse(str(xml_path))

    lines_by_page: dict[int, list[XmlLine]] = {}
    for page_elem in root.xpath("//page"):
        page_number = int(page_elem.get("number", "1"))
        page_index = page_number - 1
        page_width = int(page_elem.get("width"))
        page_height = int(page_elem.get("height"))
        pdf_page_height = float(pdf_reader.pages[page_index].mediabox.height)

        fontspecs: dict[str, str] = {}
        for font_elem in page_elem.xpath("./fontspec"):
            fontspecs[font_elem.get("id")] = font_elem.get("family", "")

        fragments: list[XmlFragment] = []
        for text_elem in page_elem.xpath("./text"):
            text = "".join(text_elem.itertext())
            if not normalize_space(text):
                continue
            font_id = text_elem.get("font")
            family = fontspecs.get(font_id, "")
            italic = is_italic_family(family) or bool(text_elem.xpath(".//i"))
            fragments.append(
                XmlFragment(
                    top=int(text_elem.get("top")),
                    left=int(text_elem.get("left")),
                    width=int(text_elem.get("width")),
                    height=int(text_elem.get("height")),
                    text=text,
                    font_family=family,
                    italic=italic,
                )
            )

        grouped: list[list[XmlFragment]] = []
        for frag in sorted(fragments, key=lambda item: (item.top, item.left)):
            if grouped and abs(grouped[-1][0].top - frag.top) <= 5:
                grouped[-1].append(frag)
            else:
                grouped.append([frag])

        page_lines: list[XmlLine] = []
        for group in grouped:
            ordered = sorted(group, key=lambda item: item.left)
            text = normalize_space("".join(item.text for item in ordered))
            left = min(item.left for item in ordered)
            right = max(item.left + item.width for item in ordered)
            top = min(item.top for item in ordered)
            bottom = max(item.top + item.height for item in ordered)
            left_margin = left
            right_margin = page_width - right
            center = (left + right) / 2
            is_centered = (
                min(left_margin, right_margin) >= 140
                and abs(left_margin - right_margin) <= 120
            )
            normalized = normalize_compare(text)
            page_lines.append(
                XmlLine(
                    page_index=page_index,
                    page_width=page_width,
                    page_height=page_height,
                    top=top,
                    bottom=bottom,
                    left=left,
                    right=right,
                    text=text,
                    fragments=ordered,
                    center=center,
                    is_centered=is_centered,
                    is_all_caps=all_caps_text(text),
                    is_full_line_italic=all(item.italic for item in ordered if normalize_space(item.text)),
                    normalized=normalized,
                    y_pdf_estimate=xml_bottom_to_pdf_y(bottom, page_height, pdf_page_height),
                )
            )

        lines_by_page[page_index] = page_lines
    return lines_by_page


def build_pdf_lines(pdf_reader: PdfReader) -> dict[int, list[PdfLine]]:
    page_lines: dict[int, list[PdfLine]] = {}

    for page_index, page in enumerate(pdf_reader.pages):
        current_stack: list[tuple] = []
        pieces: list[McidPiece] = []

        def before(operator, operands, _cm, _tm) -> None:
            if operator == b"BDC":
                current_stack.append(tuple(operands))
            elif operator == b"BMC":
                current_stack.append(tuple(operands))
            elif operator == b"EMC" and current_stack:
                current_stack.pop()

        def visitor_text(text, _cm, tm, font_dict, _font_size) -> None:
            if not normalize_space(text):
                return
            mcid = None
            tag = None
            for item in reversed(current_stack):
                if len(item) == 2 and isinstance(item[1], dict) and "/MCID" in item[1]:
                    mcid = int(item[1]["/MCID"])
                    tag = str(item[0])
                    break
            pieces.append(
                McidPiece(
                    mcid=mcid,
                    tag=tag,
                    text=text,
                    x=float(tm[4]),
                    y=float(tm[5]),
                    font=str(font_dict.get("/BaseFont")) if font_dict else None,
                )
            )

        page.extract_text(visitor_operand_before=before, visitor_text=visitor_text)

        grouped: list[list[McidPiece]] = []
        for piece in sorted(pieces, key=lambda item: (-item.y, item.x)):
            if grouped and abs(grouped[-1][0].y - piece.y) <= 1.5:
                grouped[-1].append(piece)
            else:
                grouped.append([piece])

        page_records: list[PdfLine] = []
        for group in grouped:
            ordered = sorted(group, key=lambda item: item.x)
            text = normalize_space("".join(item.text for item in ordered))
            mcids: list[int] = []
            tags: dict[int, str | None] = {}
            texts_by_mcid: dict[int, list[str]] = defaultdict(list)
            fonts_by_mcid: dict[int, set[str]] = defaultdict(set)
            for item in ordered:
                if item.mcid is None:
                    continue
                if item.mcid not in mcids:
                    mcids.append(item.mcid)
                tags[item.mcid] = item.tag
                texts_by_mcid[item.mcid].append(item.text)
                if item.font:
                    fonts_by_mcid[item.mcid].add(item.font)
            page_records.append(
                PdfLine(
                    page_index=page_index,
                    text=text,
                    normalized=normalize_compare(text),
                    y=ordered[0].y,
                    x_min=min(item.x for item in ordered),
                    mcids=mcids,
                    tags=tags,
                    texts_by_mcid={key: normalize_space("".join(value)) for key, value in texts_by_mcid.items()},
                    fonts_by_mcid=dict(fonts_by_mcid),
                )
            )
        page_lines[page_index] = page_records

    return page_lines


def find_matching_pdf_line(xml_line: XmlLine, pdf_lines: list[PdfLine]) -> PdfLine | None:
    best: PdfLine | None = None
    best_score = 0.0
    for pdf_line in pdf_lines:
        y_delta = abs(xml_line.y_pdf_estimate - pdf_line.y)
        if y_delta > 8:
            continue
        score = similarity(xml_line.normalized, pdf_line.normalized)
        if xml_line.normalized and pdf_line.normalized:
            shorter, longer = sorted((xml_line.normalized, pdf_line.normalized), key=len)
            if shorter and shorter in longer:
                score = max(score, len(shorter) / len(longer))
        if score > best_score:
            best = pdf_line
            best_score = score
    return best if best_score >= 0.6 else None


def build_repeated_top_block(
    lines: list[XmlLine],
    title_norm: str,
    author_norm: str,
) -> int | None:
    top_lines = [line for line in sorted(lines, key=lambda item: item.top) if line.top < 220]
    repeated = [
        line
        for line in top_lines
        if resembles_title_fragment(line.normalized, title_norm)
        or similarity(line.normalized, author_norm) >= 0.8
    ]
    if not repeated:
        return None

    cutoff = max(line.bottom for line in repeated)
    extended = True
    while extended:
        extended = False
        for line in top_lines:
            if line.bottom <= cutoff:
                continue
            if line.top - cutoff > 18:
                continue
            if (
                line.is_all_caps
                or (line.is_centered and not line.is_full_line_italic)
                or resembles_title_fragment(line.normalized, title_norm)
            ):
                cutoff = line.bottom
                extended = True
    return cutoff


def choose_primary_mcids(pdf_line: PdfLine) -> tuple[list[int], list[int]]:
    if not pdf_line.mcids:
        return ([], [])

    substantive: list[int] = []
    auxiliary: list[int] = []
    for mcid in pdf_line.mcids:
        text = normalize_space(pdf_line.texts_by_mcid.get(mcid, ""))
        normalized = normalize_compare(text)
        if not normalized or re.fullmatch(r"[0-9.]+", text):
            auxiliary.append(mcid)
            continue
        substantive.append(mcid)

    if substantive:
        return (substantive, auxiliary)

    longest = max(pdf_line.mcids, key=lambda item: len(normalize_compare(pdf_line.texts_by_mcid.get(item, ""))))
    auxiliary = [mcid for mcid in pdf_line.mcids if mcid != longest]
    return ([longest], auxiliary)


def infer_h3_candidates(
    lines: list[XmlLine],
    matched_pdf_lines: dict[tuple[int, str, int], PdfLine],
) -> list[XmlLine]:
    inferred: list[XmlLine] = []
    for line in lines:
        if not line.is_centered or not line.normalized:
            continue
        if line.is_all_caps or line.is_full_line_italic:
            continue
        pdf_line = matched_pdf_lines.get((line.page_index, line.normalized, line.top))
        if pdf_line is None:
            continue
        current_tags = {tag for tag in pdf_line.tags.values() if tag}
        is_existing_heading = any(tag in HEADING_TAGS for tag in current_tags)
        looks_numbered = bool(re.match(r"^[0-9]+[.)]?\s", line.text))
        looks_special = line.text.startswith("#")
        if is_existing_heading or looks_numbered or looks_special:
            inferred.append(line)
    return inferred


def determine_heading_targets(
    pdf_path: Path,
    content_dir: Path,
    xml_lines_by_page: dict[int, list[XmlLine]],
    pdf_lines_by_page: dict[int, list[PdfLine]],
    title_page: int = 0,
) -> tuple[list[HeadingTarget], set[tuple[int, int]], set[tuple[int, int]]]:
    frontmatter = parse_frontmatter(content_dir / f"{pdf_path.stem}.md")
    canonical_title = frontmatter.get("title", pdf_path.stem)
    canonical_author = frontmatter.get("author", "")
    title_norm = normalize_compare(canonical_title)
    author_norm = normalize_compare(canonical_author)

    all_xml_lines = [line for page_lines in xml_lines_by_page.values() for line in page_lines]
    matched_pdf_by_line_key: dict[tuple[int, str, int], PdfLine] = {}
    for line in all_xml_lines:
        pdf_line = find_matching_pdf_line(line, pdf_lines_by_page.get(line.page_index, []))
        if pdf_line is None:
            continue
        matched_pdf_by_line_key[(line.page_index, line.normalized, line.top)] = pdf_line

    ignored_heading_mcids: set[tuple[int, int]] = set()
    selected_heading_mcids: set[tuple[int, int]] = set()
    targets: list[HeadingTarget] = []

    # The article's title page, which is page 1 once a flyleaf is prepended. Reading
    # page 0 unconditionally made the flyleaf's own "WHITESTONE PUBLICATIONS" imprint
    # the detected H1, and it became the document's only root bookmark.
    page0_lines = xml_lines_by_page.get(title_page, [])
    caps_page0 = [line for line in page0_lines if line.is_all_caps]

    title_block: list[XmlLine] = []
    abstract_line = next(
        (line for line in page0_lines if line.normalized == "abstract"),
        None,
    )
    if abstract_line is None:
        abstract_line = next(
            (line for line in page0_lines if line.is_centered and line.is_full_line_italic),
            None,
        )
    pre_abstract_caps = [
        line for line in caps_page0 if abstract_line is None or line.bottom <= abstract_line.top
    ]
    if pre_abstract_caps:
        title_block = [pre_abstract_caps[-1]]
        while len(pre_abstract_caps) > len(title_block):
            prev_line = pre_abstract_caps[-len(title_block) - 1]
            if title_block[0].top - prev_line.bottom <= 12:
                title_block.insert(0, prev_line)
            else:
                break
    else:
        fallback = [
            line
            for line in page0_lines
            if abstract_line is None or line.bottom <= abstract_line.top
        ]
        if fallback:
            best_line = max(
                fallback,
                key=lambda line: (
                    resembles_title_fragment(line.normalized, title_norm),
                    line.is_centered,
                    line.right - line.left,
                ),
            )
            title_block = [best_line]

    if title_block:
        detected_title = normalize_space(" ".join(line.text for line in title_block))
        bookmark_title = canonical_title
        if similarity(normalize_compare(detected_title), title_norm) < 0.7:
            bookmark_title = detected_title
        detected_title_norm = normalize_compare(detected_title)
        primary_mcids: list[int] = []
        auxiliary_mcids: list[int] = []
        page_index = title_block[0].page_index
        for line in title_block:
            pdf_line = matched_pdf_by_line_key.get((line.page_index, line.normalized, line.top))
            if not pdf_line:
                continue
            primary, aux = choose_primary_mcids(pdf_line)
            primary_mcids.extend(primary)
            auxiliary_mcids.extend(aux)
        targets.append(
            HeadingTarget(
                level="H1",
                title=bookmark_title,
                page_index=page_index,
                # A title block whose lines all failed to match a PDF line used to
                # raise from min() on an empty sequence and abort the whole run.
                top=min(
                    (matched_pdf_by_line_key[(line.page_index, line.normalized, line.top)].y
                     for line in title_block
                     if (line.page_index, line.normalized, line.top) in matched_pdf_by_line_key),
                    default=0.0,
                ),
                xml_line=title_block[0],
                pdf_line=matched_pdf_by_line_key.get(
                    (title_block[0].page_index, title_block[0].normalized, title_block[0].top)
                ),
                primary_mcids=primary_mcids,
                auxiliary_mcids=auxiliary_mcids,
            )
        )
        for line in page0_lines:
            if line.is_centered and line.bottom <= title_block[0].top:
                pdf_line = matched_pdf_by_line_key.get((line.page_index, line.normalized, line.top))
                if not pdf_line:
                    continue
                for mcid in pdf_line.mcids:
                    ignored_heading_mcids.add((line.page_index, mcid))
    else:
        detected_title_norm = title_norm

    per_page_repeated_cutoff = {
        page_index: build_repeated_top_block(lines, detected_title_norm, author_norm)
        for page_index, lines in xml_lines_by_page.items()
    }

    inferred_h3 = {
        (line.page_index, line.normalized, line.top)
        for line in infer_h3_candidates(all_xml_lines, matched_pdf_by_line_key)
    }

    chosen_lines: set[tuple[int, str, int]] = set()
    in_bibliography = False
    if title_block:
        for line in title_block:
            chosen_lines.add((line.page_index, line.normalized, line.top))

    for line in all_xml_lines:
        key = (line.page_index, line.normalized, line.top)
        pdf_line = matched_pdf_by_line_key.get(key)
        if not pdf_line:
            continue

        if any((line.page_index, mcid) in ignored_heading_mcids for mcid in pdf_line.mcids):
            continue

        repeated_cutoff = per_page_repeated_cutoff.get(line.page_index)
        if line.page_index > 0 and repeated_cutoff is not None and line.bottom <= repeated_cutoff:
            for mcid in pdf_line.mcids:
                ignored_heading_mcids.add((line.page_index, mcid))
            continue

        if line.page_index > 0 and line.top < 90:
            for mcid in pdf_line.mcids:
                ignored_heading_mcids.add((line.page_index, mcid))
            continue

        if line.page_index > 0 and line.top < 220:
            if resembles_title_fragment(line.normalized, detected_title_norm) or similarity(line.normalized, author_norm) >= 0.8:
                for mcid in pdf_line.mcids:
                    ignored_heading_mcids.add((line.page_index, mcid))
                continue

        if line.bottom > line.page_height - 80:
            continue

        if key in chosen_lines:
            continue

        if key not in chosen_lines and resembles_title_fragment(line.normalized, detected_title_norm):
            for mcid in pdf_line.mcids:
                ignored_heading_mcids.add((line.page_index, mcid))
            continue

        level: str | None = None
        title = line.text
        if line.is_centered and line.is_all_caps:
            level = "H2"
        elif (
            line.is_centered
            and line.is_full_line_italic
            and not line.text.lstrip().startswith(("-", "–", "—"))
            and next((ch for ch in line.text if ch.isalpha()), "").isupper()
            and not re.search(r"\d+$", line.text)
        ):
            level = "H2"
        elif key in inferred_h3:
            level = "H3"

        if level is None:
            continue

        if level == "H2":
            in_bibliography = line.normalized in BIBLIOGRAPHY_HEADINGS
        elif level == "H3" and in_bibliography:
            continue

        primary, auxiliary = choose_primary_mcids(pdf_line)
        if not primary and not auxiliary:
            continue

        targets.append(
            HeadingTarget(
                level=level,
                title=title,
                page_index=line.page_index,
                top=pdf_line.y,
                xml_line=line,
                pdf_line=pdf_line,
                primary_mcids=primary,
                auxiliary_mcids=auxiliary,
            )
        )
        chosen_lines.add(key)

    for target in targets:
        for mcid in target.primary_mcids:
            selected_heading_mcids.add((target.page_index, mcid))

    return (targets, selected_heading_mcids, ignored_heading_mcids)


def collect_parent_tree_nums(node, lookup: dict[int, pikepdf.Array]) -> None:
    if "/Nums" in node:
        nums = node["/Nums"]
        for index in range(0, len(nums), 2):
            lookup[int(nums[index])] = nums[index + 1]
    if "/Kids" not in node:
        return
    for kid in list(node["/Kids"]):
        collect_parent_tree_nums(kid, lookup)


def build_parent_tree_lookup(pdf: pikepdf.Pdf) -> dict[int, pikepdf.Array]:
    lookup: dict[int, pikepdf.Array] = {}
    collect_parent_tree_nums(pdf.Root.StructTreeRoot.ParentTree, lookup)
    return lookup


def get_struct_elem_for_mcid(
    pdf: pikepdf.Pdf,
    parent_lookup: dict[int, pikepdf.Array],
    page_index: int,
    mcid: int,
):
    page = pdf.pages[page_index]
    struct_parents = int(page.StructParents)
    parent_array = parent_lookup[struct_parents]
    if mcid >= len(parent_array):
        return None
    return parent_array[mcid]


def retag_pdf(
    pdf_path: Path,
    content_dir: Path,
    dry_run: bool = False,
) -> dict[str, int]:
    reader = PdfReader(str(pdf_path))
    has_flyleaf = "Stable URL:" in (reader.pages[0].extract_text() or "")
    title_page = 1 if has_flyleaf and len(reader.pages) > 1 else 0
    xml_lines_by_page = build_xml_lines(pdf_path, reader)
    pdf_lines_by_page = build_pdf_lines(reader)
    targets, selected_heading_mcids, ignored_heading_mcids = determine_heading_targets(
        pdf_path, content_dir, xml_lines_by_page, pdf_lines_by_page, title_page
    )

    if dry_run:
        print(f"[dry-run] {pdf_path.name}")
        for target in targets:
            print(f"  {target.level}: p{target.page_index + 1} {target.title}")
        return {
            "targets": len(targets),
            "selected_mcids": len(selected_heading_mcids),
            "ignored_mcids": len(ignored_heading_mcids),
        }

    pdf = pikepdf.Pdf.open(str(pdf_path), allow_overwriting_input=True)
    parent_lookup = build_parent_tree_lookup(pdf)

    tag_updates = 0
    demotions = 0
    for target in targets:
        desired = Name(f"/{target.level}")
        for mcid in target.primary_mcids:
            struct_elem = get_struct_elem_for_mcid(pdf, parent_lookup, target.page_index, mcid)
            if struct_elem is None:
                continue
            if str(struct_elem.get("/S")) != str(desired):
                struct_elem["/S"] = desired
                tag_updates += 1
        for mcid in target.auxiliary_mcids:
            struct_elem = get_struct_elem_for_mcid(pdf, parent_lookup, target.page_index, mcid)
            if struct_elem is None:
                continue
            text = normalize_space(target.pdf_line.texts_by_mcid.get(mcid, ""))
            if re.fullmatch(r"[0-9.]+", text):
                if str(struct_elem.get("/S")) in HEADING_TAGS and str(struct_elem.get("/S")) != "/Span":
                    struct_elem["/S"] = Name("/Span")
                    demotions += 1
            else:
                if str(struct_elem.get("/S")) != str(desired):
                    struct_elem["/S"] = desired
                    tag_updates += 1

    for page_index, mcid in sorted(ignored_heading_mcids):
        struct_elem = get_struct_elem_for_mcid(pdf, parent_lookup, page_index, mcid)
        if struct_elem is None:
            continue
        current = str(struct_elem.get("/S"))
        if current not in HEADING_TAGS:
            continue
        text = ""
        if page_index in pdf_lines_by_page:
            for line in pdf_lines_by_page[page_index]:
                if mcid in line.texts_by_mcid:
                    text = normalize_space(line.texts_by_mcid[mcid])
                    break
        desired = Name("/Span") if re.fullmatch(r"[0-9.]+", text) else Name("/P")
        if current != str(desired):
            struct_elem["/S"] = desired
            demotions += 1

    title_targets = [target for target in targets if target.level == "H1"]
    h2_targets = [target for target in targets if target.level == "H2"]
    h3_targets = [target for target in targets if target.level == "H3"]

    with pdf.open_outline() as outline:
        outline.root.clear()
        if has_flyleaf:
            # check_flyleafs.py requires the two root bookmarks to be Flyleaf and the
            # article title, in that order; section headings hang off the title.
            outline.root.append(OutlineItem("Flyleaf", destination=0, page_location="Fit"))
        # The root bookmark is the document's own /Title, not the visually detected
        # heading. Detection sweeps up whatever shares the title block -- an author
        # line, an ORCID -- and check_flyleafs.py compares this label against /Title.
        root_label = normalize_space(str((reader.metadata or {}).get("/Title", "")))
        if root_label or title_targets:
            root_target = title_targets[0] if title_targets else None
            root_item = OutlineItem(
                root_label or root_target.title,
                destination=root_target.page_index if root_target else title_page,
                page_location="FitH",
                top=(root_target.top + 12) if root_target else None,
            )
            outline.root.append(root_item)
            current_h2_item = None
            for target in sorted(h2_targets + h3_targets, key=lambda item: (item.page_index, -item.top, item.title)):
                item = OutlineItem(
                    target.title,
                    destination=target.page_index,
                    page_location="FitH",
                    top=target.top + 12,
                )
                if target.level == "H2":
                    root_item.children.append(item)
                    current_h2_item = item
                elif current_h2_item is not None:
                    current_h2_item.children.append(item)
                else:
                    root_item.children.append(item)

    pdf.Root.PageMode = Name("/UseOutlines")
    pdf.save(str(pdf_path))

    return {
        "targets": len(targets),
        "selected_mcids": len(selected_heading_mcids),
        "ignored_mcids": len(ignored_heading_mcids),
        "tag_updates": tag_updates,
        "demotions": demotions,
        "h2_count": len(h2_targets),
        "h3_count": len(h3_targets),
    }


def iter_target_pdfs(pdf_dir: Path) -> Iterable[Path]:
    for path in sorted(pdf_dir.glob("*.pdf")):
        if path.name in IGNORED_PDFS:
            continue
        yield path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Retag heading structure and rebuild outlines for JCRT PDFs")
    parser.add_argument("--pdf-dir", required=True, help="Directory containing the PDFs to rewrite")
    parser.add_argument("--content-dir", required=True, help="Directory containing canonical article markdown files")
    parser.add_argument("--dry-run", action="store_true", help="Preview detected heading targets without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_dir = Path(args.pdf_dir).expanduser().resolve()
    content_dir = Path(args.content_dir).expanduser().resolve()

    for pdf_path in iter_target_pdfs(pdf_dir):
        summary = retag_pdf(pdf_path, content_dir, dry_run=args.dry_run)
        if args.dry_run:
            continue
        print(
            f"[updated] {pdf_path.name}: "
            f"{summary['targets']} headings, "
            f"{summary['h2_count']} h2, {summary['h3_count']} h3, "
            f"{summary['tag_updates']} tag changes, {summary['demotions']} demotions"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
