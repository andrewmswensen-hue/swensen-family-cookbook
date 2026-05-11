#!/usr/bin/env python3
"""
Post-process a docx-js output to fix duplicate <w:bookmarkStart>/<w:bookmarkEnd>
w:id values.  docx-js (as of v9.x) hardcodes w:id="1" on every bookmark, which
violates the OOXML schema and breaks internal hyperlinks in some readers.

We rewrite the IDs to be unique and properly matched in stack order
(bookmarkStart pushes a new id; the next bookmarkEnd pops it).

Usage:  python3 fix_bookmarks.py Swensen_Family_Cookbook.docx
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path


def fix(docx_path):
    p = Path(docx_path)
    tmp = p.with_suffix(".tmp.docx")

    with zipfile.ZipFile(p, "r") as src:
        contents = {name: src.read(name) for name in src.namelist()}

    if "word/document.xml" not in contents:
        print("ERROR: no word/document.xml in", docx_path)
        return False

    xml = contents["word/document.xml"].decode("utf-8")

    # Start the new IDs well above any existing ones to avoid collisions.
    existing = [int(m) for m in re.findall(r'w:id="(\d+)"', xml)]
    next_id = (max(existing) + 100) if existing else 100

    out_parts = []
    stack = []   # remembers IDs assigned to open bookmarkStart elements
    pos = 0

    for m in re.finditer(r"<w:bookmark(Start|End)[^/]*/>", xml):
        out_parts.append(xml[pos:m.start()])
        kind, tag = m.group(1), m.group(0)
        if kind == "Start":
            new_id = next_id
            next_id += 1
            stack.append(new_id)
            tag = re.sub(r'w:id="\d+"', f'w:id="{new_id}"', tag)
        else:  # End
            new_id = stack.pop() if stack else next_id
            tag = re.sub(r'w:id="\d+"', f'w:id="{new_id}"', tag)
        out_parts.append(tag)
        pos = m.end()
    out_parts.append(xml[pos:])

    contents["word/document.xml"] = "".join(out_parts).encode("utf-8")

    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
        for name, data in contents.items():
            dst.writestr(name, data)

    shutil.move(str(tmp), str(p))
    print(f"Fixed {sum(1 for _ in re.finditer(r'<w:bookmarkStart', xml))} bookmark IDs in {p.name}")
    return True


if __name__ == "__main__":
    fix(sys.argv[1])
