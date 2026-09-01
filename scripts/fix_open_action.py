#!/usr/bin/env python3
"""Drop /OpenAction entries whose destination is not in the page tree.

Flyleaf replacement in update_pdf_metadata.py unlinks the old flyleaf page but
leaves /OpenAction pointing at it, which makes Acrobat reject the file with
"The document's page tree contains an invalid node." Removing the key is enough:
Acrobat then opens at page 1 with the viewer's default zoom, which is the
original intent and matches the articles that never grew a stale /OpenAction.

Only broken entries are removed, so the script is a safe no-op on healthy files
and can be re-run at will. Run check_pdf_destinations.py afterwards to confirm.

Usage:
  python3 scripts/fix_open_action.py archives/25.2/*.pdf           # dry run
  python3 scripts/fix_open_action.py --write archives/25.2/*.pdf   # apply
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pikepdf

from check_pdf_destinations import destination_problem, live_pages


def repair(path: Path, write: bool) -> str | None:
    """Return a description of the removed /OpenAction, or None if there was none."""
    timestamps = path.stat()
    with pikepdf.open(path) as pdf:
        problem = destination_problem(pdf.Root.get("/OpenAction"), live_pages(pdf))
        if not problem:
            return None
        if not write:
            return problem
        del pdf.Root["/OpenAction"]
        tmp_path = path.with_name(f"{path.stem}.openaction.tmp.pdf")
        pdf.save(tmp_path, fix_metadata_version=False)
    tmp_path.replace(path)
    os.utime(path, ns=(timestamps.st_atime_ns, timestamps.st_mtime_ns))
    return problem


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--write", action="store_true", help="apply the fix (default: report only)")
    args = parser.parse_args()

    repaired = 0
    for path in args.pdfs:
        problem = repair(path, args.write)
        if problem:
            repaired += 1
            print(f"{path}: {'removed' if args.write else 'would remove'} /OpenAction — {problem}")
    verb = "repaired" if args.write else "need repair"
    print(f"checked {len(args.pdfs)} PDFs; {repaired} {verb}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
