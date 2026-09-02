#!/usr/bin/env python3
"""Rebuild page tagging and put link annotations into the structure tree.

Two jobs, in the order Acrobat needs them.

1. Re-tag the pages. normalize_footnote_type.py rewrites content streams, which
   drops the marked content the structure tree points at. ensure_tagged() from
   update_pdf_metadata.py rebuilds it, so this reuses that rather than growing a
   second tagger. Pass --skip-retag for files whose content is untouched.

2. Tag the link annotations. Every /Link in these files already carries /Contents
   alt text, but none had /StructParent, so none appeared in the structure tree
   and Acrobat's "Tagged annotations" check failed on all of them. Each link gets
   a /Link structure element holding an /OBJR back-reference, a ParentTree entry,
   and a /StructParent pointing at it.

ensure_tagged() numbers the ParentTree 0..n-1, one entry per page, and leaves
/ParentTreeNextKey at n. Annotation keys carry on from there, which keeps /Nums
sorted -- Acrobat rejects an unsorted number tree.

Usage:
  python3 scripts/tag_pdf_annotations.py archives/25.2/*.pdf
  python3 scripts/tag_pdf_annotations.py --skip-retag archives/25.2/*.pdf
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pikepdf
from pypdf import PdfReader, PdfWriter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_pdf_metadata import ensure_tagged


def retag_pages(path: Path) -> None:
    reader = PdfReader(str(path))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    ensure_tagged(writer, reader, None, force=True)
    tmp_path = path.with_name(f"{path.stem}.retag.tmp.pdf")
    with tmp_path.open("wb") as handle:
        writer.write(handle)
    tmp_path.replace(path)


def tag_annotations(path: Path) -> int:
    """Give every link annotation a structure element. Returns how many were tagged."""
    with pikepdf.open(path, allow_overwriting_input=True) as pdf:
        root = pdf.Root
        struct_root = root.get("/StructTreeRoot")
        if struct_root is None:
            raise RuntimeError("no /StructTreeRoot; re-tag first")
        document = struct_root["/K"]
        if isinstance(document, pikepdf.Array):
            document = document[0]
        nums = struct_root["/ParentTree"]["/Nums"]
        next_key = int(struct_root.get("/ParentTreeNextKey", len(pdf.pages)))

        tagged = 0
        for page in pdf.pages:
            page_ref = page.obj if hasattr(page, "obj") else page
            for annotation in page.get("/Annots") or []:
                if not isinstance(annotation, pikepdf.Dictionary):
                    continue
                if annotation.get("/Subtype") != "/Link":
                    continue
                if annotation.get("/StructParent") is not None:
                    continue
                element = pdf.make_indirect(pikepdf.Dictionary(
                    Type=pikepdf.Name("/StructElem"),
                    S=pikepdf.Name("/Link"),
                    P=document,
                    Pg=page_ref,
                    K=pikepdf.Array([pikepdf.Dictionary(
                        Type=pikepdf.Name("/OBJR"),
                        Obj=annotation,
                    )]),
                ))
                # /Contents is the annotation's own alt text; mirroring it onto the
                # structure element is what a screen reader announces for the link.
                contents = annotation.get("/Contents")
                if contents is not None:
                    element["/Alt"] = contents
                document["/K"].append(element)
                nums.append(next_key)
                nums.append(element)
                annotation["/StructParent"] = next_key
                next_key += 1
                tagged += 1

        struct_root["/ParentTreeNextKey"] = next_key
        if tagged:
            tmp_path = path.with_name(f"{path.stem}.annots.tmp.pdf")
            pdf.save(tmp_path, fix_metadata_version=False)
        else:
            return 0
    tmp_path.replace(path)
    return tagged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--skip-retag", action="store_true",
                        help="only tag annotations; leave page marked content alone")
    parser.add_argument("--retag-only", action="store_true",
                        help="only rebuild page marked content; leave annotations alone")
    args = parser.parse_args()

    total = 0
    for path in args.pdfs:
        timestamps = path.stat()
        if not args.skip_retag:
            retag_pages(path)
        tagged = 0 if args.retag_only else tag_annotations(path)
        os.utime(path, ns=(timestamps.st_atime_ns, timestamps.st_mtime_ns))
        total += tagged
        print(f"{path}: {tagged} link annotations tagged")
    print(f"\ntagged {total} annotations across {len(args.pdfs)} PDFs", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
