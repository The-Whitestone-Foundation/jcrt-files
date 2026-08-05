#!/usr/bin/env python3
"""Verify canonical copyright metadata on every archive PDF."""

import re
from pathlib import Path

from pypdf import PdfReader


NOTICE = "Copyright © held by the author(s). Published in the Journal for Cultural and Religious Theory."
URL = "https://jcrt.org/copyright/"
CONFLICT = re.compile(r"creative\s+commons|cc[- ]by|by-nc-nd|creativecommons\.org|fair-use provisions", re.I)
pdfs = sorted(Path("archives").glob("[0-9]*.[0-9]/*.pdf"))
failures = []

for pdf in pdfs:
    reader = PdfReader(pdf)
    info = reader.metadata or {}
    metadata = reader.root_object.get("/Metadata")
    xmp = metadata.get_object().get_data().decode("utf-8", "ignore") if metadata else ""
    combined = "\n".join(str(value) for value in info.values()) + "\n" + xmp
    if info.get("/Rights") != NOTICE or info.get("/CopyrightURL") != URL:
        failures.append(f"{pdf}: incorrect PDF Info rights")
    if NOTICE not in xmp or URL not in xmp:
        failures.append(f"{pdf}: incorrect XMP rights")
    if CONFLICT.search(combined):
        failures.append(f"{pdf}: conflicting rights assertion")

if len(pdfs) != 682:
    failures.append(f"expected 682 PDFs, found {len(pdfs)}")
if failures:
    raise SystemExit("\n".join(failures))
print(f"Validated canonical copyright metadata on {len(pdfs)} PDFs.")
