#!/usr/bin/env python3
"""
Add a new top-level 'Sous Vide' section to docs/recipes.json with two guide
entries and four placeholder recipes.  Idempotent — re-running won't duplicate.

Inserts new entries between the last Main Dishes recipe and the first
Breakfast recipe so they land in the natural cookbook flow.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


HOW_TO_BODY = """### What is Sous Vide?

Sous vide (French for "under vacuum") is a method of cooking food sealed in a bag, submerged in a precisely temperature-controlled water bath. The water is heated to your target serving temperature — say 130 °F for medium-rare steak — and the food cooks gradually to exactly that temperature. Because the water never goes hotter than your target, the food cannot overcook.

### Why it's a game-changer

Impossible to overcook. Once your steak is at 130 °F, leaving it in for another hour still leaves it at 130 °F. The technique forgives you for forgetting it on the counter.

Juicier results, especially for lean meats. Chicken breast, pork chops, fish, and turkey are easy to dry out with conventional cooking. Sous vide keeps every fiber at the exact temperature it should be, edge to edge, never a degree higher.

Even cooking. No more gray overdone ring around a pink center — sous vide steak is medium-rare from crust to crust.

Hands-off. Drop it in, walk away, sear at the end.

### Basic supplies

A sous vide immersion circulator — clips onto a pot and circulates the water at a set temperature. Popular brands: Anova, Joule, Inkbird.

A pot or food-safe container — anything that holds 6 to 12 quarts of water. A standard stockpot works fine; insulated containers retain heat better.

Sealable bags — vacuum-sealer bags are ideal, but heavy-duty zip-top freezer bags work too. Use the water-displacement method: slowly lower the bag into water with the zipper open until the bag's air is squeezed out, then seal at the surface.

A way to sear at the end — a cast-iron skillet ripping hot, or a propane/butane torch. The interior comes out perfect from the sous vide; the crust comes from the post-cook sear.

### Basic workflow

Season your food. Drop it in a bag with any aromatics — butter, garlic, herbs. Remove the air and seal the bag.

Heat your water bath to the target temperature using the circulator.

Once the bath is at temperature, lower the sealed bag in. Set a timer.

When the timer goes off, pull the bag out. Pat the meat dry — this is critical for a good sear.

Sear hard on a screaming-hot pan with a little oil and butter, 30 to 60 seconds per side, or torch the surface. Rest 5 minutes. Slice and serve.

### Where to learn more

America's Test Kitchen's "Sous Vide for Everybody" is a great starting point — clear technique, tested recipes, and time/temperature tables for everything from eggs to short ribs."""


MEAT_TEMP_BODY = """Per America's Test Kitchen's tested sous vide times and temperatures. Add about 1 hour to any of these if the meat goes into the bath frozen.

### Chicken

150 °F (66 °C) for 90 minutes. Yields chicken breast that is fully cooked, safe, and remarkably juicy — the meat stays moist instead of drying out the way it does past 165 °F in a conventional oven.

### Pork chops

140 °F (60 °C) for 2 to 3 hours. Tender and rosy-pink throughout, never overdone. Sear hard at the end for the crust.

### Steak, medium rare

126 to 134 °F (52 to 57 °C) for 90 minutes up to 3 hours. Choose the lower end of the range for a deeper red center, the higher end for warm-pink edge to edge. Always sear hard at the end — a torch or smoking-hot cast iron is ideal.

### Cooking from frozen

Add about 1 hour to all times above. The food safely thaws and cooks through inside the temperature window — no need to thaw first.

### Always sear at the end

Sous vide gets the interior right. The crust comes from the sear. Pat the meat dry, then sear in a screaming-hot pan with oil for 30 to 60 seconds per side, or use a propane torch on the surface."""


PLACEHOLDER_BODY = """_Recipe coming soon._

_Andrew will add his method here.  Start with the Meat Temperature Guide for the time and temperature, then sear hard at the end._"""


def make_entry(id_slug, title, subsection, body, credit=None, tags=None):
    return {
        "id": id_slug,
        "title": title,
        "alt_title": None,
        "section": "Sous Vide",
        "subsection": subsection,
        "credit": credit,
        "body": body,
        "tags": tags or [],
    }


NEW_ENTRIES = [
    make_entry(
        "sous-vide-how-to-sous-vide",
        "How to Sous Vide",
        "How to Sous Vide",
        HOW_TO_BODY,
        credit="Adapted from America's Test Kitchen",
        tags=["sous-vide", "guide", "technique"],
    ),
    make_entry(
        "sous-vide-meat-temperature-guide",
        "Meat Temperature Guide",
        "Meat Temperature Guide",
        MEAT_TEMP_BODY,
        credit="America's Test Kitchen",
        tags=["sous-vide", "guide", "temperature", "meat"],
    ),
    make_entry(
        "sous-vide-tri-tip",
        "Sous Vide Tri-Tip",
        "Beef",
        PLACEHOLDER_BODY,
        tags=["sous-vide", "beef", "main", "placeholder"],
    ),
    make_entry(
        "sous-vide-pork-chops",
        "Sous Vide Pork Chops",
        "Pork",
        PLACEHOLDER_BODY,
        tags=["sous-vide", "pork", "main", "placeholder"],
    ),
    make_entry(
        "sous-vide-marinated-chicken-breast",
        "Sous Vide Marinated Chicken Breast",
        "Chicken",
        PLACEHOLDER_BODY,
        tags=["sous-vide", "chicken", "poultry", "main", "placeholder"],
    ),
    make_entry(
        "sous-vide-carrots",
        "Sous Vide Carrots",
        "Veggies",
        PLACEHOLDER_BODY,
        tags=["sous-vide", "vegetables", "side", "placeholder"],
    ),
]


def main():
    data = json.loads(JSON_PATH.read_text())

    # Skip if already added
    existing_ids = {r["id"] for r in data}
    to_add = [e for e in NEW_ENTRIES if e["id"] not in existing_ids]
    if not to_add:
        print("Sous Vide entries already present — nothing to do.")
        return

    # Insert just before the first Breakfast recipe (after the last Main Dish)
    insert_at = next((i for i, r in enumerate(data) if r["section"] == "Breakfast"), None)
    if insert_at is None:
        raise RuntimeError("Couldn't find a Breakfast section to insert before")

    data = data[:insert_at] + to_add + data[insert_at:]
    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    print(f"Inserted {len(to_add)} Sous Vide entries at position {insert_at}:")
    for e in to_add:
        print(f"  · {e['subsection']:30s} {e['title']}")


if __name__ == "__main__":
    main()
