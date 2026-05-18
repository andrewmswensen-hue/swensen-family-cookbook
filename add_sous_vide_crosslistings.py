#!/usr/bin/env python3
"""
Cross-list every Sous Vide recipe in its natural section so people who
browse Main Dishes → Beef (or Vegetables → Potatoes, etc.) also see it.

Each cross-listing is a separate recipe entry with:
  - A new id of the form `<section_slug>-sous-vide-<title_slug>`
  - A title in ALL CAPS prefixed "SOUS VIDE - <STRIPPED_TITLE>" so it's
    visually distinct from non-sous-vide recipes in the same list
  - The same body, credit, and tags as the original (single source of truth
    for content lives on the original Sous Vide entry; cross-listings are
    just discovery aids)

Idempotent: re-running just updates the bodies of already-inserted entries.
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


def strip_sous_vide(title):
    """Remove 'Sous Vide' from a title (any position) so we can re-add it as a prefix."""
    cleaned = re.sub(r"\bSous Vide\b", "", title, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


# (source_id, target_section, target_subsection)
CROSSLISTINGS = [
    ("sous-vide-tri-tip",                    "Main Dishes",        "Beef"),
    ("sous-vide-marinated-chicken-breast",   "Main Dishes",        "Chicken & Turkey"),
    ("sous-vide-pork-chops",                 "Main Dishes",        "Pork & Sausage"),
    ("sous-vide-better-than-braised-beets",  "Vegetables & Sides", "Vegetables"),
    ("sous-vide-perfect-asparagus",          "Vegetables & Sides", "Vegetables"),
    ("sous-vide-crispy-smashed-potatoes",    "Vegetables & Sides", "Potatoes"),
]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def make_crosslisting(source, section, subsection):
    """Build a cross-listing entry from an existing sous vide recipe."""
    stripped = strip_sous_vide(source["title"])
    title = f"SOUS VIDE - {stripped.upper()}"
    new_id = f"{slug(section)}-sous-vide-{slug(stripped)}"
    return {
        "id":         new_id,
        "title":      title,
        "alt_title":  source.get("alt_title"),
        "section":    section,
        "subsection": subsection,
        "credit":     source.get("credit"),
        "body":       source["body"],
        "tags":       list(set((source.get("tags") or []) + ["sous-vide"])),
        "_source_id": source["id"],   # for traceability; harmless to the app
    }


def insertion_index(data, section, subsection):
    """Return the index AFTER the last existing recipe in (section, subsection)."""
    last = None
    for i, r in enumerate(data):
        if r["section"] == section and (r.get("subsection") or None) == subsection:
            last = i
    return (last + 1) if last is not None else len(data)


def main():
    data = json.loads(JSON_PATH.read_text())
    by_id = {r["id"]: r for r in data}

    added = 0
    updated = 0
    for source_id, section, subsection in CROSSLISTINGS:
        source = by_id.get(source_id)
        if source is None:
            raise RuntimeError(f"Source recipe '{source_id}' not found")

        new_entry = make_crosslisting(source, section, subsection)

        # If the cross-listing already exists, refresh its body/tags in place.
        existing = next((r for r in data if r["id"] == new_entry["id"]), None)
        if existing:
            existing.update(new_entry)
            updated += 1
            continue

        # Otherwise insert at the bottom of the target subsection.
        idx = insertion_index(data, section, subsection)
        data.insert(idx, new_entry)
        added += 1

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Added {added} new cross-listings, refreshed {updated} existing ones.")
    print("Map:")
    for source_id, section, subsection in CROSSLISTINGS:
        src = by_id[source_id]
        clone = make_crosslisting(src, section, subsection)
        print(f"  {src['title']:55s} -> {section} > {subsection}: {clone['title']}")


if __name__ == "__main__":
    main()
