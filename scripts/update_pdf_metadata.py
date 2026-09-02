#!/usr/bin/env python3
"""
Copy updated archive PDFs into place and rebuild JCRT metadata from canonical frontmatter.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import runpy
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from shutil import copy2
from types import SimpleNamespace
from typing import Any
from xml.sax.saxutils import escape

import yaml
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    ContentStream,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

COPYRIGHT_NOTICE = (
    "Copyright \u00a9 held by the author(s). Published in the Journal for Cultural "
    "and Religious Theory."
)
COPYRIGHT_URL = "https://jcrt.org/copyright/"
# Articles dated on/after CC_BY_SINCE (or with `license: cc-by` in front matter) carry the
# open license; must match `license.since` in jcrt-v2/_data/metadata.yaml and
# check_pdf_rights.py. `license: none` in front matter opts a file out.
CC_BY_SINCE = "2026-08-24"
CC_BY_NOTICE = (
    "\u00a9 the author(s). Published in the Journal for Cultural and Religious Theory "
    "under a Creative Commons Attribution 4.0 International (CC BY 4.0) license. "
    "Authors retain copyright."
)
CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/"
JOURNAL_NAME = "The Journal for Cultural and Religious Theory"
PUBLISHER = "Whitestone Publications"
ISSN = "1530-5228"
DEFAULT_ARCHIVE_BASE_URL = "https://jcrt.org/archives/24.2"
DEFAULT_KEYWORDS = ["Religion", "Philosophy", "Cultural theory"]

XMP_TEMPLATE = """\
<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
        xmlns:cc="http://creativecommons.org/ns#"
        xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"
        xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">{title}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq>{author_seq}</rdf:Seq></dc:creator>
      <dc:publisher>{publisher}</dc:publisher>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">{description}</rdf:li></rdf:Alt></dc:description>
      <dc:subject><rdf:Bag>{keyword_items}</rdf:Bag></dc:subject>
      <dc:type>article</dc:type>
      <dc:language>en</dc:language>
      <dc:source>{journal_name}, ISSN {issn}</dc:source>
      <dc:identifier>{identifier}</dc:identifier>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">{copyright}</rdf:li></rdf:Alt></dc:rights>
      <dc:relation><rdf:Bag><rdf:li>{permalink}</rdf:li></rdf:Bag></dc:relation>
      <xmpRights:WebStatement>{copyright_url}</xmpRights:WebStatement>
      <xmpRights:Marked>True</xmpRights:Marked>
      {license_xmp}
      <pdfuaid:part>1</pdfuaid:part>
      <prism:publicationName>{journal_name}</prism:publicationName>
      <prism:issn>{issn}</prism:issn>
      <prism:url>{permalink}</prism:url>
      {prism_doi}
      {prism_volume}
      {prism_number}
      {prism_start_page}
      {prism_end_page}
      {prism_pub_date}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""


@dataclass
class ArticleMetadata:
    slug: str
    title: str
    author_display: str
    authors: list[str]
    description: str
    subject: str
    keywords: list[str]
    volume: str
    issue: str
    start_page: str
    end_page: str
    publication_date: str
    permalink: str
    doi: str
    article_type: str
    generated: bool
    cc_by: bool = False

    @property
    def rights(self) -> tuple[str, str]:
        return (CC_BY_NOTICE, CC_BY_URL) if self.cc_by else (COPYRIGHT_NOTICE, COPYRIGHT_URL)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        value = "; ".join(str(item) for item in value if str(item).strip())
    text = str(value).replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def xml_text(value: str) -> str:
    return escape(value, {'"': "&quot;"})


def parse_frontmatter(md_path: Path) -> dict[str, Any]:
    text = md_path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        raise ValueError(f"missing frontmatter in {md_path}")
    return yaml.safe_load(match.group(1)) or {}


def split_authors(author_str: str) -> list[str]:
    if not author_str:
        return []
    if ";" in author_str:
        return [part.strip() for part in author_str.split(";") if part.strip()]
    if author_str.count(",") >= 2:
        parts = [part.strip() for part in re.split(r",\s*(?:and\s+)?", author_str, flags=re.IGNORECASE) if part.strip()]
        if len(parts) > 1:
            return parts
    return [author_str.strip()]


def parse_pages(pages_value: Any) -> tuple[str, str]:
    text = clean_text(pages_value)
    if not text:
        return ("", "")
    match = re.match(r"^(\d+)\s*[-\u2013]\s*(\d+)$", text)
    if not match:
        return ("", "")
    return (match.group(1), match.group(2))


def normalize_keyword(value: Any) -> str:
    text = clean_text(value)
    if not text:
        return ""
    text = re.sub(r"[-_]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    normalized = text.title()
    return {"Philosophly": "Philosophy", "And Cultural Theory": "Cultural theory"}.get(normalized, normalized)


def strip_controlled_subjects(value: Any, subjects: list[str]) -> str:
    """Remove verbatim controlled-subject labels from a stored /Keywords string.

    They are re-appended after the merge, so dropping them here means a second
    run sees the same input as the first instead of the comma-split remains of
    labels such as "Chalmers, David John, 1966-".
    """
    text = clean_text(value)
    if not text or not subjects:
        return text
    # Only labels that cannot survive a re-parse need lifting out. One that comes
    # back through split-and-normalize unchanged is already deduped correctly, so
    # leaving it alone keeps the stored keyword order stable.
    subjects = [subject for subject in subjects if parse_existing_keywords(subject) != [subject]]
    for subject in sorted(subjects, key=len, reverse=True):
        pattern = re.compile(rf"(?:(?<=^)|(?<=,\s)|(?<=,)){re.escape(subject)}(?=\s*(?:,|$))")
        text = pattern.sub("", text)
    parts = [part.strip() for part in text.split(",")]
    return ", ".join(part for part in parts if part)


def parse_existing_keywords(value: Any) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    parts = [normalize_keyword(part) for part in re.split(r"[;,]", text)]
    return [part for part in parts if part]


def normalize_frontmatter_keywords(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items = value
    else:
        items = [value]
    keywords: list[str] = []
    for item in items:
        keyword = normalize_keyword(item)
        if keyword:
            keywords.append(keyword)
    return keywords


def merge_keywords(existing_value: Any, frontmatter_value: Any) -> list[str]:
    existing = parse_existing_keywords(existing_value)
    frontmatter = normalize_frontmatter_keywords(frontmatter_value)
    merged: list[str] = []
    seen: set[str] = set()
    for keyword in [*existing, *frontmatter]:
        key = keyword.casefold()
        if not keyword or key in seen:
            continue
        merged.append(keyword)
        seen.add(key)
    return merged or list(DEFAULT_KEYWORDS)


def controlled_subjects(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [
        clean_text(item.get("label"))
        for item in value
        if isinstance(item, dict) and item.get("scheme") == "FAST" and item.get("label")
    ]


def format_pub_date(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return str(value.isoformat())[:10]
    text = clean_text(value)
    return text[:10]


def load_existing_metadata(pdf_path: Path) -> dict[str, Any]:
    if not pdf_path.exists():
        return {}
    return PdfReader(str(pdf_path)).metadata or {}


def load_permalink(citations_dir: Path | None, slug: str, archive_base_url: str) -> str:
    if citations_dir is not None:
        citation_path = citations_dir / f"{slug}.csl.json"
        if citation_path.exists():
            data = json.loads(citation_path.read_text(encoding="utf-8"))
            if data and isinstance(data, list):
                url = clean_text(data[0].get("URL"))
                if url:
                    return url
    return f"{archive_base_url.rstrip('/')}/{slug}/"


def collect_article_metadata(
    slug: str,
    md_path: Path,
    current_pdf_path: Path,
    citations_dir: Path | None,
    archive_base_url: str,
) -> ArticleMetadata:
    frontmatter = parse_frontmatter(md_path)
    existing_meta = load_existing_metadata(current_pdf_path)

    title = clean_text(frontmatter.get("title")) or clean_text(existing_meta.get("/Title")) or slug
    author_display = clean_text(frontmatter.get("author")) or clean_text(existing_meta.get("/Author"))
    description = (
        clean_text(frontmatter.get("description"))
        or clean_text(existing_meta.get("/Description"))
        or clean_text(existing_meta.get("/Subject"))
    )
    subjects = controlled_subjects(frontmatter.get("subjects"))
    # Controlled subject labels are appended verbatim, so a label containing a
    # comma or hyphen would be split and flattened when a later run re-parses
    # /Keywords. Lift them out of the existing string first to keep runs idempotent.
    keywords = merge_keywords(strip_controlled_subjects(existing_meta.get("/Keywords"), subjects), frontmatter.get("keywords"))
    seen_keywords = {keyword.casefold() for keyword in keywords}
    for subject in subjects:
        if subject.casefold() not in seen_keywords:
            keywords.append(subject)
            seen_keywords.add(subject.casefold())
    volume = clean_text(frontmatter.get("volume")) or clean_text(existing_meta.get("/Volume"))
    issue = clean_text(frontmatter.get("issue")) or clean_text(existing_meta.get("/Issue"))
    start_page, end_page = parse_pages(frontmatter.get("pages"))
    publication_date = (
        format_pub_date(frontmatter.get("date"))
        or clean_text(frontmatter.get("year"))
        or clean_text(existing_meta.get("/PublicationDate"))
    )
    permalink = load_permalink(citations_dir, md_path.stem, archive_base_url)
    doi = clean_text(frontmatter.get("doi"))
    layout = clean_text(frontmatter.get("layout")).casefold()
    article_type = "Review" if "review" in layout or title.casefold().startswith("review") else "Article"
    license_flag = clean_text(frontmatter.get("license")).casefold()
    cc_by = license_flag == "cc-by" or (license_flag != "none" and bool(publication_date) and publication_date[:10] >= CC_BY_SINCE)

    return ArticleMetadata(
        slug=slug,
        title=title,
        author_display=author_display,
        authors=split_authors(author_display),
        description=description,
        subject=description,
        keywords=keywords,
        volume=volume,
        issue=issue,
        start_page=start_page,
        end_page=end_page,
        publication_date=publication_date,
        permalink=permalink,
        doi=doi,
        article_type=article_type,
        generated=frontmatter.get("pdf") is False,
        cc_by=cc_by,
    )


def build_xmp(meta: ArticleMetadata) -> bytes:
    author_seq = "".join(f"<rdf:li>{xml_text(author)}</rdf:li>" for author in meta.authors)
    notice, notice_url = meta.rights
    license_xmp = (
        f'<xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">{xml_text(notice)}</rdf:li></rdf:Alt></xmpRights:UsageTerms>'
        f'<cc:license rdf:resource="{xml_text(notice_url)}"/>'
        if meta.cc_by else ""
    )
    keyword_items = "".join(f"<rdf:li>{xml_text(keyword)}</rdf:li>" for keyword in meta.keywords)
    xml = XMP_TEMPLATE.format(
        title=xml_text(meta.title),
        author_seq=author_seq,
        publisher=xml_text(PUBLISHER),
        description=xml_text(meta.description),
        keyword_items=keyword_items,
        journal_name=xml_text(JOURNAL_NAME),
        issn=xml_text(ISSN),
        identifier=xml_text(meta.doi or meta.permalink),
        copyright=xml_text(notice),
        copyright_url=xml_text(notice_url),
        license_xmp=license_xmp,
        permalink=xml_text(meta.permalink),
        prism_doi=f"<prism:doi>{xml_text(meta.doi)}</prism:doi>" if meta.doi else "",
        prism_volume=f"<prism:volume>{xml_text(meta.volume)}</prism:volume>" if meta.volume else "",
        prism_number=f"<prism:number>{xml_text(meta.issue)}</prism:number>" if meta.issue else "",
        prism_start_page=f"<prism:startingPage>{xml_text(meta.start_page)}</prism:startingPage>" if meta.start_page else "",
        prism_end_page=f"<prism:endingPage>{xml_text(meta.end_page)}</prism:endingPage>" if meta.end_page else "",
        prism_pub_date=f"<prism:publicationDate>{xml_text(meta.publication_date)}</prism:publicationDate>" if meta.publication_date else "",
    )
    return xml.encode("utf-8")


def build_info_metadata(meta: ArticleMetadata) -> dict[str, str]:
    info = {
        "/Title": meta.title,
        "/Author": meta.author_display,
        "/Subject": meta.subject,
        "/Keywords": ", ".join(meta.keywords),
        "/Description": meta.description,
        "/Publisher": PUBLISHER,
        "/JournalTitle": JOURNAL_NAME,
        "/ISSN": ISSN,
        "/Rights": meta.rights[0],
        "/CopyrightURL": meta.rights[1],
        "/Permalink": meta.permalink,
        "/URL": meta.permalink,
    }
    if meta.volume:
        info["/Volume"] = meta.volume
    if meta.issue:
        info["/Issue"] = meta.issue
    if meta.start_page:
        info["/StartPage"] = meta.start_page
    if meta.end_page:
        info["/EndPage"] = meta.end_page
    if meta.publication_date:
        info["/PublicationDate"] = meta.publication_date
    if meta.doi:
        info["/DOI"] = meta.doi
    return info


def ensure_tagged(writer: PdfWriter, reader: PdfReader, transcript_pdf: Path | None = None, force: bool = False) -> None:
    mark_info = writer._root_object.get("/MarkInfo")
    if hasattr(mark_info, "get_object"):
        mark_info = mark_info.get_object()
    if not force and isinstance(mark_info, DictionaryObject) and mark_info.get("/Marked"):
        return

    struct_root = DictionaryObject({NameObject("/Type"): NameObject("/StructTreeRoot")})
    struct_root_ref = writer._add_object(struct_root)
    document = DictionaryObject({
        NameObject("/Type"): NameObject("/StructElem"),
        NameObject("/S"): NameObject("/Document"),
        NameObject("/P"): struct_root_ref,
        NameObject("/K"): ArrayObject(),
    })
    document_ref = writer._add_object(document)
    struct_root[NameObject("/K")] = ArrayObject([document_ref])
    parent_numbers = ArrayObject()

    transcript = PdfReader(str(transcript_pdf)) if transcript_pdf else None
    font_ref = None
    if transcript:
        # ponytail: this handwritten scan has a human transcript; use it when OCR cannot read the script.
        font_ref = writer._add_object(DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
        }))

    for index, page in enumerate(writer.pages):
        contents = reader.pages[index].get_contents()
        stream = ContentStream(contents, reader) if contents is not None else ContentStream(DecodedStreamObject(), reader)
        marked = []
        keep_ends = []
        for operands, operator in stream.operations:
            if operator in (b"BMC", b"BDC"):
                keep = bool(operands and operands[0] == "/Artifact")
                keep_ends.append(keep)
                if keep:
                    marked.append((operands, operator))
            elif operator == b"EMC":
                if keep_ends.pop() if keep_ends else False:
                    marked.append((operands, operator))
            else:
                marked.append((operands, operator))
        stream.operations = marked
        data = stream.get_data()
        if transcript and index < len(transcript.pages):
            resources = page.get("/Resources")
            if hasattr(resources, "get_object"):
                resources = resources.get_object()
            if not isinstance(resources, DictionaryObject):
                resources = DictionaryObject()
                page[NameObject("/Resources")] = resources
            fonts = resources.get("/Font")
            if hasattr(fonts, "get_object"):
                fonts = fonts.get_object()
            if not isinstance(fonts, DictionaryObject):
                fonts = DictionaryObject()
                resources[NameObject("/Font")] = fonts
            fonts[NameObject("/JCRTTranscript")] = font_ref
            encoded = []
            for line in (transcript.pages[index].extract_text() or "").splitlines():
                value = line.strip()[:240].encode("cp1252", "replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
                if value:
                    encoded.append(b"(" + value + b") Tj T*")
            top = max(1, int(float(page.mediabox.height)) - 1)
            prefix = f"\nBT /JCRTTranscript 1 Tf 3 Tr 1 0 0 1 1 {top} Tm 1 TL\n".encode()
            data += prefix + b"\n".join(encoded) + b"\nET\n"
        source = DecodedStreamObject()
        source.set_data(data)
        stream = ContentStream(source, reader)
        tagged = []
        artifact_depth = 0
        paragraph_open = False
        mcid_count = 0
        for operands, operator in stream.operations:
            artifact_start = operator in (b"BMC", b"BDC") and operands and operands[0] == "/Artifact"
            if artifact_start:
                if paragraph_open:
                    tagged.append(([], b"EMC"))
                    paragraph_open = False
                artifact_depth += 1
                tagged.append((operands, operator))
            elif operator == b"EMC" and artifact_depth:
                tagged.append((operands, operator))
                artifact_depth -= 1
            elif artifact_depth:
                tagged.append((operands, operator))
            else:
                if not paragraph_open:
                    tagged.append(([NameObject("/P"), DictionaryObject({NameObject("/MCID"): NumberObject(mcid_count)})], b"BDC"))
                    mcid_count += 1
                    paragraph_open = True
                tagged.append((operands, operator))
        if paragraph_open:
            tagged.append(([], b"EMC"))
        stream.operations = tagged
        page[NameObject("/Contents")] = writer._add_object(stream)
        page[NameObject("/StructParents")] = NumberObject(index)
        paragraphs = ArrayObject()
        for mcid in range(mcid_count):
            paragraph = DictionaryObject({
                NameObject("/Type"): NameObject("/StructElem"),
                NameObject("/S"): NameObject("/P"),
                NameObject("/P"): document_ref,
                NameObject("/Pg"): page.indirect_reference,
                NameObject("/K"): NumberObject(mcid),
            })
            paragraph_ref = writer._add_object(paragraph)
            document[NameObject("/K")].append(paragraph_ref)
            paragraphs.append(paragraph_ref)
        parent_numbers.extend([NumberObject(index), paragraphs])
        annotations = page.get("/Annots") or []
        if annotations:
            page[NameObject("/Tabs")] = NameObject("/S")
        for annotation_ref in annotations:
            annotation = annotation_ref.get_object()
            annotation.pop(NameObject("/StructParent"), None)
            if annotation.get("/Subtype") != "/Link":
                continue
            action = annotation.get("/A") or {}
            if hasattr(action, "get_object"):
                action = action.get_object()
            label = str(annotation.get("/Contents") or action.get("/URI") or "Link")
            annotation[NameObject("/Contents")] = TextStringObject(label)

    parent_tree = DictionaryObject({NameObject("/Nums"): parent_numbers})
    struct_root[NameObject("/ParentTree")] = writer._add_object(parent_tree)
    struct_root[NameObject("/ParentTreeNextKey")] = NumberObject(len(writer.pages))
    writer._root_object[NameObject("/StructTreeRoot")] = struct_root_ref
    writer._root_object[NameObject("/MarkInfo")] = DictionaryObject({NameObject("/Marked"): BooleanObject(True)})


def write_pdf(source_pdf: Path, dest_pdf: Path, meta: ArticleMetadata, flyleaf=None, replace_flyleaf=False) -> None:
    timestamps = dest_pdf.stat() if dest_pdf.exists() else source_pdf.stat()
    reader = PdfReader(str(source_pdf))
    has_flyleaf = "Stable URL:" in (reader.pages[0].extract_text() or "")
    flyleaf_added = False
    combined_path = dest_pdf.with_name(f"{dest_pdf.stem}.combined.tmp.pdf")
    if flyleaf and (replace_flyleaf or not has_flyleaf):
        module, assets = flyleaf
        first_page = reader.pages[0]
        flyleaf_path = dest_pdf.with_name(f"{dest_pdf.stem}.flyleaf.tmp.pdf")
        module["build"](
            SimpleNamespace(
                output=str(flyleaf_path),
                title=meta.title,
                author=meta.authors or [meta.author_display or "JCRT Editors"],
                stable_url=meta.permalink,
                doi=meta.doi,
                type=meta.article_type,
                page_width=float(first_page.mediabox.width),
                page_height=float(first_page.mediabox.height),
            ),
            assets,
        )
        combined = PdfWriter()
        combined.clone_document_from_reader(reader)
        if meta.generated or has_flyleaf:
            combined.remove_page(0)
        if meta.generated or replace_flyleaf:
            combined._root_object.pop(NameObject("/Outlines"), None)
        # remove_page() unlinks the old flyleaf but does not sweep references to
        # it. A surviving /OpenAction leaves Acrobat resolving a page that is no
        # longer in the page tree, which it reports as an invalid page tree node.
        combined._root_object.pop(NameObject("/OpenAction"), None)
        combined.insert_page(PdfReader(str(flyleaf_path)).pages[0], 0)
        combined.add_outline_item("Flyleaf", 0)
        if (meta.generated or replace_flyleaf) and len(combined.pages) > 1:
            combined.add_outline_item(meta.title, 1)
        with combined_path.open("wb") as fh:
            combined.write(fh)
        flyleaf_path.unlink()
        reader = PdfReader(str(combined_path))
        flyleaf_added = True
        has_flyleaf = True

    def outline_pages(items):
        for item in items:
            if isinstance(item, list):
                yield from outline_pages(item)
            elif hasattr(item, "title"):
                try:
                    yield reader.get_destination_page_number(item)
                except Exception:
                    pass

    try:
        has_article_outline = any(page == 1 for page in outline_pages(reader.outline))
    except Exception:
        has_article_outline = False
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    candidate = source_pdf.with_name("duncan-transcription.pdf")
    transcript = candidate if source_pdf.stem.casefold() == "scans" and candidate.exists() else None
    ensure_tagged(writer, reader, transcript, force=flyleaf_added)
    info = build_info_metadata(meta)
    existing_info = reader.metadata or {}
    if meta.publication_date:
        date_digits = meta.publication_date.replace("-", "")
        pdf_date = f"D:{date_digits}{'000000Z' if len(date_digits) == 8 else ''}"
        for key in ("/CreationDate", "/ModDate"):
            if not isinstance(existing_info.get(key), str) or not re.match(r"^D:\d{4}", existing_info[key]):
                info[key] = pdf_date
    writer.add_metadata(info)
    writer.xmp_metadata = build_xmp(meta)
    writer._root_object[NameObject("/Lang")] = TextStringObject("en-US")
    viewer = writer._root_object.get("/ViewerPreferences")
    if hasattr(viewer, "get_object"):
        viewer = viewer.get_object()
    if not isinstance(viewer, DictionaryObject):
        viewer = DictionaryObject()
        writer._root_object[NameObject("/ViewerPreferences")] = viewer
    viewer[NameObject("/DisplayDocTitle")] = BooleanObject(True)
    if not has_article_outline and reader.pages:
        writer.add_outline_item(meta.title, 1 if has_flyleaf and len(reader.pages) > 1 else 0)

    tmp_path = dest_pdf.with_name(f"{dest_pdf.stem}.tmp.pdf")
    with tmp_path.open("wb") as fh:
        writer.write(fh)
    tmp_path.replace(dest_pdf)
    if combined_path.exists():
        combined_path.unlink()
    os.utime(dest_pdf, ns=(timestamps.st_atime_ns, timestamps.st_mtime_ns))


def process_pdf(
    source_pdf: Path,
    archive_dir: Path,
    existing_metadata_dir: Path,
    content_dir: Path,
    citations_dir: Path | None,
    archive_base_url: str,
    dry_run: bool,
    flyleaf=None,
    replace_flyleaf=False,
) -> None:
    slug = source_pdf.stem
    dest_pdf_path = archive_dir / source_pdf.name
    existing_pdf_path = existing_metadata_dir / source_pdf.name
    markdown = sorted(content_dir.glob("*.md"))
    md_path = next((path for path in markdown if path.stem.casefold() == slug.casefold()), None)
    if md_path is None and slug.casefold() == "table-of-contents" and (content_dir / "index.njk").exists():
        md_path = content_dir / "index.njk"
    if md_path is None:
        matches = [
            path
            for path in markdown
            if Path(str(parse_frontmatter(path).get("pdf") or "")).name.casefold() == source_pdf.name.casefold()
        ]
        md_path = matches[0] if matches else None
    if md_path is None:
        pdf_title = clean_text(load_existing_metadata(existing_pdf_path).get("/Title")).casefold()
        matches = [path for path in markdown if clean_text(parse_frontmatter(path).get("title")).casefold() == pdf_title]
        md_path = matches[0] if matches else None
    if md_path is None:
        raise FileNotFoundError(f"missing canonical markdown for {source_pdf.name} in {content_dir}")

    meta = collect_article_metadata(slug, md_path, existing_pdf_path, citations_dir, archive_base_url)
    print(f"[update] {source_pdf.name}")
    print(f"  title:      {meta.title}")
    print(f"  authors:    {meta.author_display}")
    print(f"  keywords:   {', '.join(meta.keywords)}")
    print(f"  permalink:  {meta.permalink}")

    if dry_run:
        print("  dry-run:    skipped write")
        return

    if source_pdf.resolve() != dest_pdf_path.resolve():
        copy2(source_pdf, dest_pdf_path)
    write_pdf(dest_pdf_path, dest_pdf_path, meta, flyleaf, replace_flyleaf)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy updated PDFs into place and rebuild JCRT metadata")
    parser.add_argument("--updates-dir", required=True, help="Directory containing the replacement PDFs")
    parser.add_argument("--archive-dir", required=True, help="Directory containing the destination archive PDFs")
    parser.add_argument("--content-dir", required=True, help="Directory containing canonical markdown frontmatter")
    parser.add_argument("--citations-dir", help="Directory containing CSL JSON citation files")
    parser.add_argument(
        "--existing-metadata-dir",
        help="Directory to read existing archive metadata from when enriching keywords and fallback fields",
    )
    parser.add_argument("--archive-base-url", default=DEFAULT_ARCHIVE_BASE_URL, help="Canonical issue URL without article slug")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing PDFs")
    parser.add_argument("--flyleaf-script", help="Prepend a flyleaf using create-jcrt-flyleaf.py")
    parser.add_argument("--replace-flyleaf", action="store_true", help="Replace an existing flyleaf")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    updates_dir = Path(args.updates_dir).expanduser().resolve()
    archive_dir = Path(args.archive_dir).expanduser().resolve()
    content_dir = Path(args.content_dir).expanduser().resolve()
    citations_dir = Path(args.citations_dir).expanduser().resolve() if args.citations_dir else None
    existing_metadata_dir = (
        Path(args.existing_metadata_dir).expanduser().resolve()
        if args.existing_metadata_dir
        else archive_dir
    )

    if not updates_dir.exists():
        print(f"error: updates directory not found: {updates_dir}", file=sys.stderr)
        return 1
    if not archive_dir.exists():
        print(f"error: archive directory not found: {archive_dir}", file=sys.stderr)
        return 1
    if not content_dir.exists():
        print(f"error: content directory not found: {content_dir}", file=sys.stderr)
        return 1
    if citations_dir is not None and not citations_dir.exists():
        print(f"error: citations directory not found: {citations_dir}", file=sys.stderr)
        return 1
    if not existing_metadata_dir.exists():
        print(f"error: existing metadata directory not found: {existing_metadata_dir}", file=sys.stderr)
        return 1

    source_pdfs = sorted(path for path in updates_dir.glob("*.pdf"))
    if not source_pdfs:
        print(f"error: no PDFs found in {updates_dir}", file=sys.stderr)
        return 1

    flyleaf = None
    assets_temp = None
    if args.flyleaf_script:
        module = runpy.run_path(str(Path(args.flyleaf_script).expanduser().resolve()))
        assets_temp = tempfile.TemporaryDirectory(prefix="jcrt-flyleaf-assets-")
        temp = Path(assets_temp.name)
        assets = (temp / "jcrt.png", temp / "whitestone.png")
        module["svg_png"](module["JCRT_LOGO"], assets[0], 180)
        module["svg_png"](module["WHITESTONE_LOGO"], assets[1], 220)
        flyleaf = (module, assets)

    failures = 0
    try:
        for source_pdf in source_pdfs:
            try:
                process_pdf(
                    source_pdf=source_pdf,
                    archive_dir=archive_dir,
                    existing_metadata_dir=existing_metadata_dir,
                    content_dir=content_dir,
                    citations_dir=citations_dir,
                    archive_base_url=args.archive_base_url,
                    dry_run=args.dry_run,
                    flyleaf=flyleaf,
                    replace_flyleaf=args.replace_flyleaf,
                )
            except Exception as exc:  # pragma: no cover - batch CLI error reporting
                failures += 1
                print(f"[fail] {source_pdf.name}: {exc.__class__.__name__}: {exc}", file=sys.stderr)
    finally:
        if assets_temp:
            assets_temp.cleanup()

    if failures:
        print(f"done with {failures} failure(s)", file=sys.stderr)
        return 1

    print(f"done: processed {len(source_pdfs)} pdf(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
