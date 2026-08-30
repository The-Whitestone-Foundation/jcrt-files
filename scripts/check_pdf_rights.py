#!/usr/bin/env python3
"""Verify canonical copyright metadata on archive PDFs.

Replaces check_pdf_copyright.py, which re-parsed all ~700 PDFs on every run and
asserted a hardcoded file count that went stale the moment a PDF was added.

This version parses only PDFs that are new or whose bytes changed. Validated
content hashes are cached in scripts/pdf-rights-ledger.json; a PDF whose hash is
already in the ledger is skipped without ever being opened by pypdf.

The ledger is a cache, not a contract. If it is missing or stale the script simply
revalidates more files — it never fails because the ledger is out of date. Only a
genuine rights-metadata problem produces a non-zero exit.

Usage:
  python3 scripts/check_pdf_rights.py                 # new/changed PDFs only
  python3 scripts/check_pdf_rights.py --all           # revalidate everything
  python3 scripts/check_pdf_rights.py --since <ref>   # only PDFs changed since a git ref
  python3 scripts/check_pdf_rights.py --no-write      # do not update the ledger
"""

import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader

NOTICE = "Copyright © held by the author(s). Published in the Journal for Cultural and Religious Theory."
URL = "https://jcrt.org/copyright/"
CONFLICT = re.compile(r"creative\s+commons|cc[- ]by|by-nc-nd|creativecommons\.org|fair-use provisions", re.I)

REPO_ROOT = Path(__file__).resolve().parent.parent
LEDGER_PATH = REPO_ROOT / "scripts" / "pdf-rights-ledger.json"
PDF_GLOB = "[0-9]*.[0-9]/*.pdf"


def discover_pdfs():
    return sorted((REPO_ROOT / "archives").glob(PDF_GLOB))


def pdfs_changed_since(ref):
    """PDFs added or modified since `ref`, per git. Used for incremental CI runs."""
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=AMRC", ref, "--", "archives"],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except subprocess.CalledProcessError as exc:
        print(f"[pdf-rights] git diff against {ref} failed; falling back to full scan", file=sys.stderr)
        print(exc.stderr.strip(), file=sys.stderr)
        return None

    changed = []
    for line in out.splitlines():
        if not line.endswith(".pdf"):
            continue
        path = REPO_ROOT / line
        # Only files matching the archives/<volume.issue>/ layout the notice applies to.
        if path.exists() and path.match(f"*/archives/{PDF_GLOB}"):
            changed.append(path)
    return sorted(changed)


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:32]


def validate(path):
    """Return a list of failure strings for one PDF (empty when it passes)."""
    rel = path.relative_to(REPO_ROOT).as_posix()
    problems = []
    try:
        reader = PdfReader(path)
        info = reader.metadata or {}
        metadata = reader.root_object.get("/Metadata")
        xmp = metadata.get_object().get_data().decode("utf-8", "ignore") if metadata else ""
    except Exception as exc:  # a corrupt PDF is a real failure, not a skip
        return [f"{rel}: could not read PDF ({exc.__class__.__name__}: {exc})"]

    combined = "\n".join(str(value) for value in info.values()) + "\n" + xmp
    if info.get("/Rights") != NOTICE or info.get("/CopyrightURL") != URL:
        problems.append(f"{rel}: incorrect PDF Info rights")
    if NOTICE not in xmp or URL not in xmp:
        problems.append(f"{rel}: incorrect XMP rights")
    if CONFLICT.search(combined):
        problems.append(f"{rel}: conflicting rights assertion")
    return problems


def load_ledger():
    try:
        return json.loads(LEDGER_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="revalidate every PDF")
    parser.add_argument("--since", metavar="REF", help="only PDFs changed since this git ref")
    parser.add_argument("--no-write", action="store_true", help="do not update the ledger")
    args = parser.parse_args()

    all_pdfs = discover_pdfs()
    if not all_pdfs:
        print("[pdf-rights] no archive PDFs found", file=sys.stderr)
        return 1

    ledger = {} if args.all else load_ledger()

    if args.since and not args.all:
        candidates = pdfs_changed_since(args.since)
        if candidates is None:
            candidates = all_pdfs
    else:
        candidates = all_pdfs

    # Hashing is far cheaper than a pypdf parse, so it is the skip test.
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        hashes = dict(zip(candidates, pool.map(file_hash, candidates)))

    stale = [p for p in candidates if ledger.get(p.relative_to(REPO_ROOT).as_posix()) != hashes[p]]

    failures = []
    if stale:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for result in pool.map(validate, stale):
                failures.extend(result)

    if failures:
        print(f"[pdf-rights] {len(failures)} problem(s) in {len(stale)} newly checked PDF(s):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    # Only record PDFs that actually passed this run, plus what was already trusted.
    if not args.no_write:
        merged = dict(ledger)
        for path, digest in hashes.items():
            merged[path.relative_to(REPO_ROOT).as_posix()] = digest
        # Drop entries for PDFs that no longer exist so the ledger cannot grow forever.
        live = {p.relative_to(REPO_ROOT).as_posix() for p in all_pdfs}
        merged = {k: v for k, v in merged.items() if k in live}
        LEDGER_PATH.write_text(json.dumps(merged, indent=1, sort_keys=True) + "\n")

    skipped = len(candidates) - len(stale)
    print(f"[pdf-rights] validated {len(stale)} PDF(s), skipped {skipped} unchanged, {len(all_pdfs)} total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
