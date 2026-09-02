#!/usr/bin/env python3
"""Remove the bare jcrt.org hyperlink from the flyleaf footer.

The flyleaf footer reads "JCRT | jcrt.org | ISSN 1530-5228". On a handful of
files the "jcrt.org" run picked up a link annotation to https://jcrt.org, which
is not wanted — the footer is an imprint line, not navigation.

Only the bare-domain link is removed. The flyleaf's three real links (the stable
article URL under /archives/, the DOI, and the /copyright/ notice) all carry
longer paths and are matched by neither pattern here, so they survive untouched.

Usage:
  python3 scripts/fix_flyleaf_footer_link.py archives/25.2/*.pdf           # dry run
  python3 scripts/fix_flyleaf_footer_link.py --write archives/25.2/*.pdf   # apply
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pikepdf

BARE_DOMAIN = {"https://jcrt.org", "https://jcrt.org/", "http://jcrt.org", "http://jcrt.org/"}


def annotation_uri(annotation) -> str | None:
    action = annotation.get("/A")
    if not isinstance(action, pikepdf.Dictionary):
        return None
    uri = action.get("/URI")
    return str(uri) if uri is not None else None


def repair(path: Path, write: bool) -> int:
    """Return the number of bare-domain footer links found (and removed, if writing)."""
    timestamps = path.stat()
    with pikepdf.open(path) as pdf:
        flyleaf = pdf.pages[0]
        annotations = flyleaf.get("/Annots")
        if annotations is None:
            return 0
        keep = [a for a in annotations if not (
            isinstance(a, pikepdf.Dictionary)
            and a.get("/Subtype") == "/Link"
            and annotation_uri(a) in BARE_DOMAIN
        )]
        removed = len(annotations) - len(keep)
        if not removed or not write:
            return removed
        if keep:
            flyleaf["/Annots"] = pdf.make_indirect(pikepdf.Array(keep))
        else:
            del flyleaf["/Annots"]
        tmp_path = path.with_name(f"{path.stem}.footerlink.tmp.pdf")
        pdf.save(tmp_path, fix_metadata_version=False)
    tmp_path.replace(path)
    os.utime(path, ns=(timestamps.st_atime_ns, timestamps.st_mtime_ns))
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--write", action="store_true", help="apply the fix (default: report only)")
    args = parser.parse_args()

    total = 0
    for path in args.pdfs:
        removed = repair(path, args.write)
        if removed:
            total += 1
            print(f"{path}: {'removed' if args.write else 'would remove'} {removed} footer link(s)")
    verb = "repaired" if args.write else "need repair"
    print(f"checked {len(args.pdfs)} PDFs; {total} {verb}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
