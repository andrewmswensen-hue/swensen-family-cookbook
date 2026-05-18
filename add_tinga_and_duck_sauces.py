#!/usr/bin/env python3
"""
Add the now-complete Shredded Chicken Tacos (Tinga de Pollo) recipe to the
Sous Vide section, and round out the Seared Duck Breasts body with the
cooking methods for BOTH sauces — Grapefruit-Balsamic and Cherry-Port —
now that the previously-missing cookbook pages are in hand.

The 'Cherry sauce' mention in the duck's To Make Ahead note was the make-
ahead-friendly Cherry-Port Sauce, not a typo.

Idempotent — re-running just refreshes bodies.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


TINGA_BODY = """2 pounds (900 grams) boneless, skinless chicken thighs, trimmed
Salt and pepper
2 tablespoons (28 grams) vegetable oil
1 onion (140 grams), halved and sliced thin
2 tablespoons (30 grams) minced canned chipotle chile in adobo sauce
1 teaspoon (2 grams) garlic powder
1 teaspoon (2.5 grams) ground cumin
¼ teaspoon (1 gram) ground cinnamon
1 14.5-ounce can (410 grams) fire-roasted diced tomatoes, drained
½ teaspoon (2 grams) sugar
1 tablespoon (3 grams) grated lime zest plus 2 tablespoons (30 grams) juice

For the tacos:
12 to 18 (6-inch) corn tortillas, warmed
1 avocado, halved, pitted, and cut into ½-inch pieces
2 ounces (57 grams) Cotija cheese, crumbled (½ cup)
6 scallions (90 grams), minced
Minced fresh cilantro
Lime wedges

For the chicken: Using sous vide circulator, bring water to 180 °F (82 °C) in a 7-quart container.

Pat chicken dry with paper towels and season with salt and pepper.  Heat 1 tablespoon (14 grams) oil in a 12-inch skillet over medium-high heat until just smoking.  Brown half of chicken, 3 to 4 minutes per side; transfer to plate.  Repeat with remaining chicken.

Heat remaining 1 tablespoon (14 grams) oil in now-empty skillet until shimmering.  Add onion and cook until softened and lightly browned, 4 to 6 minutes.  Stir in chipotle, garlic powder, cumin, and cinnamon and cook until fragrant, about 1 minute.  Stir in tomatoes and sugar, scraping up any browned bits.  Transfer mixture to blender and process until smooth, 30 to 45 seconds, scraping down sides of blender jar as needed.

Place chicken and any accumulated juices and sauce in a 1-gallon zipper-lock freezer bag and toss to coat.  Seal bag, pressing out as much air as possible.  Place bag into a second 1-gallon zipper-lock freezer bag and seal.  Gently lower bag into prepared water bath until chicken is fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 3 hours or up to 5 hours.

Transfer chicken and sauce to a large bowl, let cool slightly, and then shred chicken into bite-size pieces using 2 forks.  Stir in lime zest and juice and season with salt and pepper to taste.

For the tacos: Spoon chicken into center of each tortilla and serve, passing avocado, Cotija, scallions, cilantro, and lime wedges separately.

### To Make Ahead

Chicken and sauce can be rapidly chilled in an ice bath and then refrigerated in zipper-lock bag after the sous vide cook for up to 5 days.  To reheat, return sealed bag to water bath set to 150 °F (65.5 °C) for 20 minutes, then proceed with shredding."""


SEARED_DUCK_BODY = """4 10-ounce (284 grams) boneless duck breasts, skin and fat cap trimmed to ¼ inch
3 sprigs (4 grams) fresh thyme
6 garlic cloves, peeled and smashed
Salt and pepper
2 tablespoons (28 grams) vegetable oil

Using sous vide circulator, bring water to 135 °F (57 °C) in a 7-quart container.

Using a sharp knife, cut slits ½ inch apart in a cross-hatch pattern in the duck skin and fat cap, being careful not to cut into the meat.  Pat duck dry with paper towels.  Place duck skin side down in a cold 12-inch nonstick skillet.  Heat skillet over medium-high heat and cook until fat begins to render and skin is lightly browned, 6 to 8 minutes.  Flip duck, add thyme sprigs and garlic to skillet, and cook until second side of breasts are opaque, about 30 seconds.  Transfer duck and thyme sprigs to a large plate.  Discard garlic and fat left in skillet and wipe clean with paper towels.

Season duck with salt and pepper.  Place duck and thyme sprigs in a 1-gallon zipper-lock freezer bag.  Seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until duck is fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 1½ hours or up to 2 hours.

Transfer duck to a paper towel–lined plate and let rest for 5 to 10 minutes.  Pat duck dry with paper towels.  Heat oil in now-empty skillet over medium-high heat until just smoking.  Place duck skin side down in skillet and cook until well browned and crisp, 2 to 4 minutes.  Transfer to cutting board and slice into ¼-inch-thick slices.  Serve with one of the sauces below.

### Grapefruit-Balsamic Sauce

Makes about ½ cup.  The success of this sauce depends on using fresh grapefruit juice.

2 tablespoons (30 grams) balsamic vinegar
2 tablespoons (28 grams) sugar
2 cups (472 grams) chicken broth
1 cup (236 grams) fresh grapefruit juice
1 teaspoon (2 grams) pepper
Salt
4 tablespoons (56 grams) unsalted butter, cut into 4 pieces and chilled

Bring vinegar and sugar to a simmer in a 12-inch skillet over medium-high heat and cook until thickened and syrupy, about 2 minutes.  Stir in chicken broth, grapefruit juice, and pepper, bring to a simmer, and cook until mixture is reduced to about ½ cup (140 grams), 10 to 14 minutes.  Off heat, whisk in butter one piece at a time, until sauce is smooth and glossy.  Season with salt to taste.

### Cherry-Port Sauce

Makes about 1½ cups.  You can substitute an equal amount of frozen sweet cherries for the fresh cherries; do not defrost them.  This sauce is best served at room temperature.

10 ounces (284 grams) fresh sweet cherries, pitted and halved
2 cups (472 grams) dry red wine
¾ cup (150 grams) sugar
¼ cup (60 grams) chicken broth
¼ cup (60 grams) plus 1 tablespoon (15 grams) red wine vinegar
¼ cup (60 grams) ruby port

Bring cherries, wine, sugar, broth, ¼ cup (60 grams) vinegar, and port to a simmer in a medium saucepan.  Cook, stirring occasionally, until mixture measures about 1½ cups (450 grams), about 30 minutes.  Transfer to a bowl and let cool to room temperature, about 2 hours.  Stir in remaining 1 tablespoon (15 grams) vinegar.

### To Make Ahead

The Cherry-Port Sauce can be refrigerated for up to 1 week; bring to room temperature before serving.  The duck itself and the Grapefruit-Balsamic Sauce should be prepared just before serving."""


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

    # ── 1. Add (or refresh) Shredded Chicken Tacos ────────────────────────
    tinga_entry = {
        "id":         "sous-vide-shredded-chicken-tacos",
        "title":      "Shredded Chicken Tacos (Tinga de Pollo)",
        "alt_title":  None,
        "section":    "Sous Vide",
        "subsection": "Chicken",
        "credit":     "America's Test Kitchen",
        "body":       TINGA_BODY,
        "tags":       ["sous-vide", "chicken", "poultry", "main", "mexican", "tacos"],
    }
    existing = by_id.get(tinga_entry["id"])
    if existing:
        existing.update(tinga_entry)
        print("Refreshed Shredded Chicken Tacos in place.")
    else:
        # Slot it right after Seared Duck Breasts (the natural neighbor in the
        # chicken subsection — the Sous Vide poultry recipes are now contiguous).
        idx = insertion_index(data, "Sous Vide", "Chicken")
        data.insert(idx, tinga_entry)
        print(f"Inserted Shredded Chicken Tacos at index {idx}.")

    # ── 2. Refresh the Duck body with both sauce methods + fixed To-Make-Ahead
    duck = by_id.get("sous-vide-seared-duck-breasts")
    if duck is None:
        raise RuntimeError("sous-vide-seared-duck-breasts not found — did you skip the earlier batch?")
    duck["body"] = SEARED_DUCK_BODY
    print("Updated Seared Duck Breasts body with both sauce methods.")

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
