#!/usr/bin/env python3
"""Extract the four Book Antiqua faces from the macOS font suitcase.

normalize_footnote_type.py needs Book Antiqua as a plain .ttf it can embed, but
the copy shipped with Microsoft Office for Mac is a classic font suitcase: the
data fork is empty and the four faces live as 'sfnt' resources in the resource
fork, which FreeType cannot open. This walks the resource map and writes each
face out as a standalone TrueType file.

Two cmap entries are dropped on the way out. Book Antiqua maps two codepoints to
each of three glyphs, and when a glyph has more than one Unicode owner the
ToUnicode CMap that PyMuPDF generates on embed may pick either. In practice it
picked the wrong one every time, so extracted text came back with soft hyphens
where the page showed ordinary hyphens. Keeping only the expected codepoint --
U+002D over U+00AD, and the real ligatures over their private-use twins --
makes the round trip exact.

The faces are licensed Microsoft fonts and must NOT be committed. Write them to
a scratch directory and pass that to --font-dir. Their fsType is 0x0000
(installable embedding), so embedding them in the archive PDFs is permitted.

Usage:
  python3 scripts/extract_book_antiqua.py /tmp/jcrt-fonts
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

SUITCASE = Path("/Library/Fonts/Microsoft/Book Antiqua")

# glyph name -> the one codepoint that should keep it.
PREFERRED = {"hyphen": 0x002D, "fi": 0xFB01, "fl": 0xFB02}

FILENAMES = {
    "Book Antiqua": "BookAntiqua.ttf",
    "Book Antiqua Bold": "BookAntiquaBold.ttf",
    "Book Antiqua Italic": "BookAntiquaItalic.ttf",
    "Book Antiqua Bold Italic": "BookAntiquaBoldItalic.ttf",
}


def sfnt_resources(raw: bytes):
    """Yield each 'sfnt' resource in a classic Mac resource fork."""
    data_off, map_off = struct.unpack(">II", raw[:8])
    type_list_off = map_off + struct.unpack(">H", raw[map_off + 24:map_off + 26])[0]
    type_count = struct.unpack(">H", raw[type_list_off:type_list_off + 2])[0] + 1
    for index in range(type_count):
        entry = type_list_off + 2 + index * 8
        if raw[entry:entry + 4] != b"sfnt":
            continue
        count = struct.unpack(">H", raw[entry + 4:entry + 6])[0] + 1
        ref_off = type_list_off + struct.unpack(">H", raw[entry + 6:entry + 8])[0]
        for item in range(count):
            ref = ref_off + item * 12
            offset = data_off + (struct.unpack(">I", raw[ref + 4:ref + 8])[0] & 0x00FFFFFF)
            length = struct.unpack(">I", raw[offset:offset + 4])[0]
            yield raw[offset + 4:offset + 4 + length]


def drop_duplicate_codepoints(font: TTFont) -> list[str]:
    """Remove the non-preferred codepoint wherever two of them share one glyph.

    Unicode subtables only. The legacy Mac Roman subtable is keyed by byte value,
    not codepoint -- 0xDE and 0xDF there are the fi and fl ligatures, and deleting
    them on the grounds that they look like U+00DE and U+00DF would be wrong.
    """
    dropped = []
    for table in font["cmap"].tables:
        if not table.isUnicode():
            continue
        for codepoint, glyph in list(table.cmap.items()):
            keep = PREFERRED.get(glyph)
            if keep is not None and codepoint != keep:
                del table.cmap[codepoint]
                dropped.append(f"{glyph} U+{codepoint:04X}")
    return dropped


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)

    fork = SUITCASE / "..namedfork" / "rsrc"
    if not fork.exists():
        print(f"{SUITCASE} is not installed", file=sys.stderr)
        return 1

    written = 0
    for blob in sfnt_resources(fork.read_bytes()):
        path = out_dir / "tmp.ttf"
        path.write_bytes(blob)
        font = TTFont(path)
        full_name = next(
            (str(record) for record in font["name"].names if record.nameID == 4), None
        )
        filename = FILENAMES.get(full_name)
        if filename is None:
            print(f"  skipping unrecognised face {full_name!r}", file=sys.stderr)
            font.close()
            continue
        dropped = drop_duplicate_codepoints(font)
        fs_type = font["OS/2"].fsType
        font.save(out_dir / filename)
        font.close()
        written += 1
        print(f"  {full_name:<26} -> {filename:<26} fsType=0x{fs_type:04x} "
              f"dropped: {', '.join(dropped) or 'nothing'}")
    (out_dir / "tmp.ttf").unlink(missing_ok=True)

    if written != len(FILENAMES):
        print(f"expected {len(FILENAMES)} faces, wrote {written}", file=sys.stderr)
        return 1
    print(f"wrote {written} faces to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
