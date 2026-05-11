#!/usr/bin/env python3
"""
Add subsection assignments to the flat sections in docs/recipes.json so the
web app can show "subcategory" cards (Pasta, Rice, Beans within Rice/Beans/Pasta,
Potatoes vs Vegetables within Vegetables & Sides, etc.).

Title-keyword based, applied once and committed to recipes.json.

Run: python3 subdivide_sections.py
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"

# Each rule: (section, subsection, predicate) — first matching rule wins per recipe.
# Recipes already carrying a subsection are left alone.
RULES = [
    # ── Rice, Beans & Pasta ───────────────────────────────────────────────
    ("Rice, Beans & Pasta", "Rice",   lambda t: re.search(r"\brice\b|\bpilaf\b", t, re.I)),
    ("Rice, Beans & Pasta", "Beans",  lambda t: re.search(r"\bbean(s)?\b|\benchilada(s)?\b", t, re.I)),
    ("Rice, Beans & Pasta", "Pasta",  lambda t: re.search(r"\bpasta\b|\bravioli\b|\bmac\b|\bshells\b", t, re.I)),

    # ── Vegetables & Sides ────────────────────────────────────────────────
    ("Vegetables & Sides", "Potatoes",
     lambda t: re.search(r"\bpotato(es)?\b|\byams?\b", t, re.I)),
    ("Vegetables & Sides", "Vegetables",
     lambda t: re.search(r"green bean|asparagus|carrot|zucchini|mushroom|brussels|broccoli|cauliflower|portobello|root veg|corn on the cob", t, re.I)),
    ("Vegetables & Sides", "Other Sides", lambda t: True),   # everything else here

    # ── Breads ────────────────────────────────────────────────────────────
    ("Breads", "Cinnamon Rolls & Crescents",
     lambda t: re.search(r"cinnamon|crescent|cinnabon", t, re.I)),
    ("Breads", "Muffins & Scones",
     lambda t: re.search(r"\bmuffin(s)?\b|\bscone(s)?\b", t, re.I)),
    ("Breads", "Biscuits & Savory",
     lambda t: re.search(r"\bbiscuit(s)?\b|\bpizza\b|\bcheese bomb(s)?\b", t, re.I)),
    ("Breads", "Jams",
     lambda t: re.search(r"\bjam\b", t, re.I)),
    ("Breads", "Loaf & Quick Breads", lambda t: True),

    # ── Appetizers ────────────────────────────────────────────────────────
    ("Appetizers", "Salsas",
     lambda t: re.search(r"\bsalsa\b", t, re.I)),
    ("Appetizers", "Wings",
     lambda t: re.search(r"\bwing(s)?\b|wing sauce", t, re.I)),
    ("Appetizers", "Dips & Spreads",
     lambda t: re.search(r"\bdip\b|\bspread\b|\bfondue\b|\bcaviar\b|\bcheese ball\b", t, re.I)),
    ("Appetizers", "Other Appetizers", lambda t: True),
]


def main():
    recipes = json.loads(JSON_PATH.read_text())
    updated = 0
    section_counts = {}

    for r in recipes:
        if r.get("subsection"):
            continue   # never overwrite an existing subsection
        for sec, sub, pred in RULES:
            if r["section"] != sec:
                continue
            if pred(r["title"]):
                r["subsection"] = sub
                updated += 1
                section_counts.setdefault((sec, sub), 0)
                section_counts[(sec, sub)] += 1
                break

    JSON_PATH.write_text(json.dumps(recipes, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {updated} recipes with subsections.")
    for (sec, sub), n in sorted(section_counts.items()):
        print(f"  {sec} → {sub}: {n}")


if __name__ == "__main__":
    main()
