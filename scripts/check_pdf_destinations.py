#!/usr/bin/env python3
"""Report PDF destinations that point outside the document's page tree.

Adobe Acrobat resolves /OpenAction when it opens a file and maps the destination
to a page index. If the destination names a page object that is not reachable
from /Root/Pages, Acrobat refuses the file with "The document's page tree
contains an invalid node." — even though the page tree itself is well formed.
qpdf --check, Ghostscript, pdfinfo and PyMuPDF all read such a file happily, so
nothing else in this repo's toolchain catches it.

The usual source is flyleaf replacement: pypdf's remove_page() unlinks the old
flyleaf from /Kids without sweeping references to it, leaving /OpenAction (and
occasionally a bookmark or link annotation) pointing at an orphaned page.

Usage:
  python3 scripts/check_pdf_destinations.py                    # all archives
  python3 scripts/check_pdf_destinations.py archives/25.2      # one issue
  python3 scripts/check_pdf_destinations.py path/to/file.pdf   # single files
"""

from __future__ import annotations

import sys
from pathlib import Path

import pikepdf

REPO_ROOT = Path(__file__).resolve().parent.parent


def live_pages(pdf: pikepdf.Pdf) -> set:
    """objgens of the pages actually reachable from /Root/Pages."""
    return {page.objgen for page in pdf.pages}


def destination_array(value):
    """Normalise a /Dest value or a GoTo action into its destination array.

    Returns None for anything that is not an explicit destination array —
    named destinations (a string or name) resolve elsewhere, and a non-GoTo
    action has no destination to check.
    """
    if isinstance(value, pikepdf.Dictionary):
        value = value.get("/D")
    if isinstance(value, pikepdf.Array):
        return value
    return None


def destination_problem(value, pages: set) -> str | None:
    """Describe why a destination is unresolvable, or None if it is fine."""
    dest = destination_array(value)
    if dest is None or len(dest) == 0:
        return None
    target = dest[0]
    if target is None:
        return "destination is null"
    if isinstance(target, pikepdf.Dictionary):
        if target.objgen in pages:
            return None
        kind = target.get("/Type") or "untyped object"
        return f"destination {target.objgen} ({kind}) is not in the page tree"
    return None


def outline_items(node, seen: set):
    """Walk an outline chain depth-first, tolerating cycles in /Next or /First."""
    while isinstance(node, pikepdf.Dictionary):
        if node.objgen in seen:
            return
        seen.add(node.objgen)
        yield node
        first = node.get("/First")
        if first is not None:
            yield from outline_items(first, seen)
        node = node.get("/Next")


def check(path: Path) -> list[str]:
    with pikepdf.open(path) as pdf:
        pages = live_pages(pdf)
        root = pdf.Root
        errors = []

        problem = destination_problem(root.get("/OpenAction"), pages)
        if problem:
            errors.append(f"/OpenAction {problem}")

        outlines = root.get("/Outlines")
        if isinstance(outlines, pikepdf.Dictionary):
            for item in outline_items(outlines.get("/First"), set()):
                title = str(item.get("/Title") or "untitled")
                for value in (item.get("/Dest"), item.get("/A")):
                    problem = destination_problem(value, pages)
                    if problem:
                        errors.append(f"bookmark {title!r} {problem}")

        for number, page in enumerate(pdf.pages, 1):
            for annotation in page.get("/Annots") or []:
                if not isinstance(annotation, pikepdf.Dictionary):
                    continue
                for value in (annotation.get("/Dest"), annotation.get("/A")):
                    problem = destination_problem(value, pages)
                    if problem:
                        errors.append(f"page {number} annotation {problem}")

        return errors


def discover(targets: list[str]) -> list[Path]:
    if not targets:
        return sorted((REPO_ROOT / "archives").glob("[0-9]*.[0-9]/*.pdf"))
    pdfs = []
    for target in targets:
        path = Path(target)
        pdfs.extend(sorted(path.rglob("*.pdf")) if path.is_dir() else [path])
    return pdfs


def main() -> int:
    pdfs = discover(sys.argv[1:])
    failures = [(path, check(path)) for path in pdfs]
    failures = [(path, errors) for path, errors in failures if errors]
    for path, errors in failures:
        print(f"{path}: {'; '.join(errors)}", file=sys.stderr)
    print(f"checked {len(pdfs)} PDFs; {len(failures)} failed")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
