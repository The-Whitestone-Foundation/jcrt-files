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

COPYRIGHT_NOTICE = (
    "Copyright \u00a9 held by the author(s). All rights reserved. "
    "This text may be used and shared in accordance with the fair-use provisions "
    "of U.S. copyright law. Any use of this text in other ways requires the consent "
    "of the author and the publisher, the Journal for Cultural and Religious Theory, "
    "and must cite publication in this journal."
)
COPYRIGHT_URL = "https://jcrt.org/copyright/"
JOURNAL_NAME = "The Journal for Cultural and Religious Theory"
PUBLISHER = "Whitestone Publications"
ISSN = "1530-5228"
DEFAULT_ARCHIVE_BASE_URL = "https://jcrt.org/archives/24.2"
DEFAULT_KEYWORDS = ["Religion", "Philosophly", "And Cultural Theory"]

XMP_TEMPLATE = """\
<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
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
    return text.title()


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
    keywords = merge_keywords(existing_meta.get("/Keywords"), frontmatter.get("keywords"))
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


def write_pdf(source_pdf: Path, dest_pdf: Path, meta: ArticleMetadata) -> None:
    reader = PdfReader(str(source_pdf))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.add_metadata(build_info_metadata(meta))
    writer.xmp_metadata = build_xmp(meta)

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
    md_path = content_dir / f"{slug}.md"
    if not md_path.exists():
        raise FileNotFoundError(f"missing canonical markdown for {source_pdf.name}: {md_path}")

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
