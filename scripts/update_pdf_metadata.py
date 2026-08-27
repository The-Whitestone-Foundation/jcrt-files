#!/usr/bin/env python3
"""
Copy updated archive PDFs into place and rebuild JCRT metadata from canonical frontmatter.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from shutil import copy2
from typing import Any
from xml.sax.saxutils import escape

import yaml
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
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
      <dc:identifier>{issn}</dc:identifier>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">{copyright}</rdf:li></rdf:Alt></dc:rights>
      <dc:relation><rdf:Bag><rdf:li>{permalink}</rdf:li></rdf:Bag></dc:relation>
      <xmpRights:WebStatement>{copyright_url}</xmpRights:WebStatement>
      <xmpRights:Marked>True</xmpRights:Marked>
      <pdfuaid:part>1</pdfuaid:part>
      <prism:publicationName>{journal_name}</prism:publicationName>
      <prism:issn>{issn}</prism:issn>
      <prism:url>{permalink}</prism:url>
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
    publication_date = format_pub_date(frontmatter.get("date")) or clean_text(existing_meta.get("/PublicationDate"))
    permalink = load_permalink(citations_dir, slug, archive_base_url)

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
    )


def build_xmp(meta: ArticleMetadata) -> bytes:
    author_seq = "".join(f"<rdf:li>{xml_text(author)}</rdf:li>" for author in meta.authors)
    keyword_items = "".join(f"<rdf:li>{xml_text(keyword)}</rdf:li>" for keyword in meta.keywords)
    xml = XMP_TEMPLATE.format(
        title=xml_text(meta.title),
        author_seq=author_seq,
        publisher=xml_text(PUBLISHER),
        description=xml_text(meta.description),
        keyword_items=keyword_items,
        journal_name=xml_text(JOURNAL_NAME),
        issn=xml_text(ISSN),
        copyright=xml_text(COPYRIGHT_NOTICE),
        copyright_url=xml_text(COPYRIGHT_URL),
        permalink=xml_text(meta.permalink),
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
        "/Rights": COPYRIGHT_NOTICE,
        "/CopyrightURL": COPYRIGHT_URL,
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
    return info


def ensure_tagged(writer: PdfWriter, reader: PdfReader, transcript_pdf: Path | None = None) -> None:
    mark_info = writer._root_object.get("/MarkInfo")
    if hasattr(mark_info, "get_object"):
        mark_info = mark_info.get_object()
    if isinstance(mark_info, DictionaryObject) and mark_info.get("/Marked"):
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
        data = contents.get_data() if contents is not None else b""
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
        stream = DecodedStreamObject()
        stream.set_data(b"/P <</MCID 0>> BDC\n" + data + b"\nEMC\n")
        page[NameObject("/Contents")] = writer._add_object(stream)
        page[NameObject("/StructParents")] = NumberObject(index)
        paragraph = DictionaryObject({
            NameObject("/Type"): NameObject("/StructElem"),
            NameObject("/S"): NameObject("/P"),
            NameObject("/P"): document_ref,
            NameObject("/Pg"): page.indirect_reference,
            NameObject("/K"): NumberObject(0),
        })
        paragraph_ref = writer._add_object(paragraph)
        document[NameObject("/K")].append(paragraph_ref)
        parent_numbers.extend([NumberObject(index), ArrayObject([paragraph_ref])])

    parent_tree = DictionaryObject({NameObject("/Nums"): parent_numbers})
    struct_root[NameObject("/ParentTree")] = writer._add_object(parent_tree)
    struct_root[NameObject("/ParentTreeNextKey")] = NumberObject(len(writer.pages))
    writer._root_object[NameObject("/StructTreeRoot")] = struct_root_ref
    writer._root_object[NameObject("/MarkInfo")] = DictionaryObject({NameObject("/Marked"): BooleanObject(True)})


def write_pdf(source_pdf: Path, dest_pdf: Path, meta: ArticleMetadata) -> None:
    reader = PdfReader(str(source_pdf))
    try:
        has_outline = bool(reader.outline)
    except Exception:
        has_outline = False
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    candidate = source_pdf.with_name("duncan-transcription.pdf")
    transcript = candidate if source_pdf.stem.casefold() == "scans" and candidate.exists() else None
    ensure_tagged(writer, reader, transcript)
    writer.add_metadata(build_info_metadata(meta))
    writer.xmp_metadata = build_xmp(meta)
    writer._root_object[NameObject("/Lang")] = TextStringObject("en-US")
    viewer = writer._root_object.get("/ViewerPreferences")
    if hasattr(viewer, "get_object"):
        viewer = viewer.get_object()
    if not isinstance(viewer, DictionaryObject):
        viewer = DictionaryObject()
        writer._root_object[NameObject("/ViewerPreferences")] = viewer
    viewer[NameObject("/DisplayDocTitle")] = BooleanObject(True)
    if not has_outline and reader.pages:
        writer.add_outline_item(meta.title, 0)

    tmp_path = dest_pdf.with_name(f"{dest_pdf.stem}.tmp.pdf")
    with tmp_path.open("wb") as fh:
        writer.write(fh)
    tmp_path.replace(dest_pdf)


def process_pdf(
    source_pdf: Path,
    archive_dir: Path,
    existing_metadata_dir: Path,
    content_dir: Path,
    citations_dir: Path | None,
    archive_base_url: str,
    dry_run: bool,
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
    write_pdf(dest_pdf_path, dest_pdf_path, meta)


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

    failures = 0
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
            )
        except Exception as exc:  # pragma: no cover - batch CLI error reporting
            failures += 1
            print(f"[fail] {source_pdf.name}: {exc.__class__.__name__}: {exc}", file=sys.stderr)

    if failures:
        print(f"done with {failures} failure(s)", file=sys.stderr)
        return 1

    print(f"done: processed {len(source_pdfs)} pdf(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
