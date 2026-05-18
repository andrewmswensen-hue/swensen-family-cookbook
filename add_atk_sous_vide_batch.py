#!/usr/bin/env python3
"""
Add 9 new America's Test Kitchen sous vide recipes (poultry, beef, pork, veg)
to the Sous Vide section.  Cross-listings into Main Dishes / Vegetables & Sides
are then created by the existing add_sous_vide_crosslistings.py script.

Tinga de Pollo and the Grapefruit-Balsamic Sauce's cooking method are pending
the missing cookbook pages — they'll be added in a follow-up commit.

Idempotent — re-running just refreshes bodies of already-present entries.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


# Each recipe body uses our usual format:
#   - ingredient lines first (one per line, formatted so classifyLine
#     recognizes them as bullets)
#   - blank line
#   - numbered instructions written as prose paragraphs (no leading number;
#     each paragraph is one step)
#   - `### To Make Ahead` and `### Variation: <name>` subsections
#
# We drop the "Why This Recipe Works" preamble per the user's preference.


POACHED_CHICKEN = """4 8-ounce (226 grams) boneless, skinless chicken breasts, trimmed
Salt and pepper
¼ cup (56 grams) vegetable oil

Using sous vide circulator, bring water to 150 °F (65.5 °C) in a 7-quart container.

Season chicken with salt and pepper.  Place chicken and oil in a 1-gallon zipper-lock freezer bag and toss to coat.  Seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until chicken is fully submerged, then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 1 hour or up to 3 hours.

Transfer chicken to paper towel–lined plate and let rest for 5 to 10 minutes.  Serve.

### To Make Ahead

Chicken can be rapidly chilled in an ice bath and then refrigerated in a zipper-lock bag for up to 5 days.  To reheat, return the sealed bag to a water bath set to 150 °F / 65.5 °C for 20 minutes, then proceed with the resting step.

### Variation: Lemon-Thyme Poached Chicken

Combine 1 teaspoon (6 grams) salt, ½ teaspoon (2 grams) pepper, ½ teaspoon (1 gram) garlic powder, ½ teaspoon (1 gram) minced fresh thyme, and 1 teaspoon (2 grams) grated lemon zest in a bowl.  Sprinkle the chicken with this mixture in place of the plain salt and pepper.

### Variation: Soy-Ginger Poached Chicken

Omit the salt and pepper.  Whisk ¼ cup (59 grams) soy sauce, ¼ cup (50 grams) sugar, 1 teaspoon (3 grams) grated fresh ginger, 1 teaspoon (5 grams) toasted sesame oil, and ½ teaspoon (2 grams) white pepper together in a bowl.  Substitute this soy sauce mixture for the oil."""


SEARED_DUCK = """4 10-ounce (284 grams) boneless duck breasts, skin and fat cap trimmed to ¼ inch
3 sprigs (4 grams) fresh thyme
6 garlic cloves, peeled and smashed
Salt and pepper
2 tablespoons (28 grams) vegetable oil

Using sous vide circulator, bring water to 135 °F (57 °C) in a 7-quart container.

Using a sharp knife, cut slits ½ inch apart in a cross-hatch pattern in the duck skin and fat cap, being careful not to cut into the meat.  Pat duck dry with paper towels.  Place duck skin side down in a cold 12-inch nonstick skillet.  Heat skillet over medium-high heat and cook until fat begins to render and skin is lightly browned, 6 to 8 minutes.  Flip duck, add thyme sprigs and garlic to skillet, and cook until second side of breasts are opaque, about 30 seconds.  Transfer duck and thyme sprigs to a large plate.  Discard garlic and fat left in skillet and wipe clean with paper towels.

Season duck with salt and pepper.  Place duck and thyme sprigs in a 1-gallon zipper-lock freezer bag.  Seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until duck is fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 1½ hours or up to 2 hours.

Transfer duck to a paper towel–lined plate and let rest for 5 to 10 minutes.  Pat duck dry with paper towels.  Heat oil in now-empty skillet over medium-high heat until just smoking.  Place duck skin side down in skillet and cook until well browned and crisp, 2 to 4 minutes.  Transfer to cutting board and slice into ¼-inch-thick slices.  Serve with Grapefruit-Balsamic Sauce.

### Grapefruit-Balsamic Sauce

Makes about ¾ cup.  The success of this sauce depends on using fresh grapefruit juice.

2 tablespoons (30 grams) balsamic vinegar
2 tablespoons (28 grams) sugar
2 cups (472 grams) chicken broth
1 cup (236 grams) fresh grapefruit juice
Salt and pepper
4 tablespoons (56 grams) unsalted butter, cut into 4 pieces and chilled

_Cooking method for the sauce will be added once Andrew sends the next page of the recipe._"""


TURKEY_BREAST = """1 7-pound (3.18 kilogram) bone-in turkey breast
½ cup plus 2 tablespoons (140 grams) vegetable oil
Salt and pepper

Using sous vide circulator, bring water to 145 °F (63 °C) in a 7-quart container.

Using a sharp knife, cut along the rib cage of the breast to remove the two breast halves; discard the bones.  Trim excess skin from the turkey and season with salt and pepper.  Place one breast half and ¼ cup (56 grams) oil in a 1-gallon zipper-lock freezer bag.  Repeat with the second breast half and another ¼ cup of oil.  Seal bags, pressing out as much air as possible.  Gently lower bags into prepared water bath until turkey is fully submerged, then clip top corner of each bag to side of water bath container, allowing remaining air bubbles to rise to top of bags.  Reopen 1 corner of each zipper, release remaining air bubbles, and reseal bags.  Cover and cook for at least 3½ hours or up to 5 hours.

Transfer turkey to a paper towel–lined plate and let rest for 5 to 10 minutes.  Heat remaining 2 tablespoons (28 grams) oil in a 12-inch skillet over medium-high heat until just smoking.  Place turkey skin side down in skillet and cook, adjusting position with tongs as needed, until well browned and crisp, 4 to 6 minutes.  Transfer turkey to carving board and slice into ½-inch slices.  Serve.

### All-Purpose Gravy

Makes about 2 cups.

3 tablespoons (42 grams) vegetable oil
1 small onion (140 grams), chopped
1 small carrot (60 grams), peeled and chopped
1 small celery rib (60 grams), chopped
Salt and pepper
¼ cup (50 grams) all-purpose flour
4 cups (945 grams) chicken broth
¼ cup (60 grams) dry white wine
2 sprigs (1 gram) fresh thyme
1 bay leaf (0.5 grams)

Heat oil in a large saucepan over medium heat until shimmering.  Add onion, carrot, celery, and ½ teaspoon (3 grams) pepper and cook over medium heat until vegetables are softened and well browned, about 8 minutes.  Stir in flour and cook for 1 minute.  Slowly whisk in broth and wine, scraping up any browned bits and smoothing out any lumps.  Stir in thyme sprigs and bay leaf, bring to a simmer, and cook until gravy is thickened and reduced to 3 cups, about 15 minutes.  Strain gravy through a fine-mesh strainer into a bowl, pressing on solids to extract as much liquid as possible; discard solids.  Season with salt and pepper to taste."""


SHORT_RIB = """3½ pounds (1.5 kilograms) boneless beef short ribs, trimmed
Salt and pepper
2 tablespoons (28 grams) vegetable oil
1 large onion (350 grams), chopped
2 celery ribs (60 grams), chopped
1 carrot (80 grams), peeled and chopped
1 tablespoon (15 grams) tomato paste
1 garlic clove (5 grams), minced
1 cup (225 grams) dry red wine
1 cup (225 grams) beef broth
8 sprigs (4 grams) fresh thyme
2 bay leaves (1 gram)
2 tablespoons (8 grams) minced fresh parsley

Using sous vide circulator, bring water to 167 °F (75 °C) in a 7-quart container.

Pat ribs dry with paper towels and season with salt and pepper.  Heat 1 tablespoon (14 grams) oil in a Dutch oven over medium-high heat until just smoking.  Brown half the ribs on all sides, 8 to 12 minutes; transfer to a plate.  Repeat with the remaining 1 tablespoon of oil and remaining ribs.

Add onion, celery, carrot, ½ teaspoon (1 gram) salt, and ¼ teaspoon (1 gram) pepper to fat left in the pot and cook over medium heat until softened and lightly browned, 8 to 10 minutes.  Stir in tomato paste and garlic and cook until fragrant, about 1 minute.  Stir in wine, scraping up any browned bits, and cook until reduced by half, 2 to 4 minutes.  Stir in broth and simmer for 2 minutes.  Transfer mixture to a blender and process until smooth, about 1 minute.

Divide ribs, sauce, thyme sprigs, and bay leaves between two 1-gallon zipper-lock freezer bags and toss to coat.  Arrange ribs in a single layer and seal bags, pressing out as much air as possible.  Place each bag in a second 1-gallon zipper-lock freezer bag and seal.  Gently lower bags into prepared water bath until ribs are fully submerged, and then clip top corner of each bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of each zipper, release remaining air bubbles, and reseal bags.  Cover and cook for at least 20 hours or up to 24 hours.

Using tongs, transfer ribs to a serving dish.  Tent with aluminum foil and let rest while finishing sauce.  Strain cooking liquid through a fine-mesh strainer into a medium saucepan, pressing on solids to extract as much liquid as possible; discard solids.  Bring to a simmer over medium heat and cook until reduced to 2 cups, 4 to 6 minutes.  Season with salt and pepper to taste.  Spoon sauce over ribs, sprinkle with parsley, and serve.

### To Make Ahead

Short rib can be rapidly chilled in an ice bath and then refrigerated in zipper-lock bags after the sous vide cook for up to 5 days.  To reheat, return sealed bags to water bath set to 167 °F / 75 °C and let sit for 30 minutes, then proceed with the sauce-finishing step."""


PEPPERCORN_ROAST_BEEF = """1 5-pound (2.3 kilograms) boneless beef chuck-eye roast, pulled into 2 pieces at natural seam and trimmed of large pieces of fat
Kosher salt and pepper
2 tablespoons (28 grams) vegetable oil
1 egg white (30 grams)
¼ cup (30 grams) coarsely ground black, green, and pink peppercorns
2 tablespoons (20 grams) flake sea salt

Sprinkle beef with 4 teaspoons (16 grams) kosher salt.  Arrange pieces side by side along natural seam, and then tie together at 1-inch intervals to create a 1 evenly shaped roast.  Transfer roast to a large plate and refrigerate, uncovered, for at least 24 hours or up to 96 hours.

Using sous vide circulator, heat water to 133 °F / 56 °C in a 12-quart container.

Heat oil in a 12-inch skillet over medium-high heat until just smoking.  Brown roast on all sides, 6 to 8 minutes.  Season roast with pepper and place into a 2-gallon zipper-lock freezer bag.  Seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until roast is fully submerged, then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 18 hours or up to 24 hours.

Adjust oven rack to middle position and heat oven to 475 °F (246 °C).  Set wire rack in aluminum foil–lined rimmed baking sheet and spray with vegetable spray.  Transfer roast to prepared rack and let rest for 10 to 15 minutes.  Pat roast dry with paper towels.

Whisk egg white in a bowl until frothy, about 30 seconds.  Combine peppercorns and flake sea salt in a shallow dish.  Brush roast on all sides with egg white, then coat with peppercorn mixture, pressing to adhere.  Return roast to prepared rack and roast until surface is evenly browned and fragrant, 15 to 20 minutes, rotating sheet halfway through roasting.

Transfer roast to carving board and slice into ½-inch-thick slices and serve.

### To Make Ahead

We don't recommend making this recipe in advance."""


OSSO_BUCO = """1 large onion (280 grams), chopped
2 carrots (160 grams), peeled and chopped
2 celery ribs (120 grams), chopped
8 garlic cloves (40 grams), minced
1 14.5-ounce can (411 grams) diced tomatoes, drained
4 12-ounce (340 grams) veal shanks, 2 inches thick, trimmed and tied around equator
Salt and pepper
¼ cup (56 grams) vegetable oil
2 tablespoons (32 grams) tomato paste
1¼ cups (290 grams) dry white wine
4 bay leaves (1 gram)
½ cup (5 grams) chopped fresh parsley

Using sous vide circulator, bring water to 176 °F (80 °C) in a 7-quart container.

Pulse onion, carrots, celery, and garlic in food processor until finely chopped, 12 to 14 pulses; transfer to bowl.  Pulse tomatoes in now-empty processor until finely chopped, 8 to 10 pulses.

Pat shanks dry with paper towels and season with salt and pepper.  Heat 2 tablespoons (28 grams) oil in a 12-inch skillet over medium-high heat until just smoking.  Brown shanks, 3 to 4 minutes per side; transfer to plate.

Heat remaining 2 tablespoons (28 grams) oil in now-empty skillet over medium heat.  Add chopped vegetables, ½ teaspoon (3 grams) salt, and ¼ teaspoon (2 grams) pepper and cook until softened and lightly browned, 16 to 20 minutes.

Stir in tomato paste and cook until fragrant, about 1 minute.  Stir in wine, scraping up any browned bits, and cook until almost completely evaporated, 4 to 6 minutes.  Stir in tomatoes and cook until mixture is thick and lightly browned, 16 to 20 minutes.

Transfer mixture to 2 1-gallon zipper-lock freezer bags.  Add shanks and bay leaves and toss to coat.  Arrange shanks in single layer and seal bags, pressing out as much air as possible.  Place bag into second 2-gallon zipper-lock freezer bag and seal bag.  Gently lower bag into prepared water bath until shanks are fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 24 hours or up to 26 hours.

Transfer shanks to serving dish, leaving sauce in bag.  Discard bay leaves.  Stir parsley into sauce and season with salt and pepper to taste.  Pour sauce over shanks and serve.

### To Make Ahead

Shanks can be rapidly chilled in an ice bath and refrigerated in zipper-lock bags for up to 5 days.  To reheat, return sealed bag to water bath set to 176 °F / 80 °C for 1 hour, then proceed with step 7."""


PORK_TENDERLOIN_STEAKS = """2 1-pound (450 grams) pork tenderloins, trimmed
Salt and pepper
¼ cup (56 grams) vegetable oil

Using sous vide circulator, bring water to 140 °F (60 °C) in a 7-quart container.

Pound tenderloins to 1-inch thickness.  Halve each tenderloin crosswise into 2 steaks.  Sprinkle each steak with ½ teaspoon (3 grams) salt and ¼ teaspoon (0.5 grams) pepper.  Place steaks and 2 tablespoons (28 grams) oil in a 1-gallon zipper-lock freezer bag and toss to coat.  Arrange steaks in single layer and seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until steaks are fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 1 hour or up to 2 hours.

Transfer steaks to paper towel–lined plate and let rest for 5 to 10 minutes.  Pat steaks dry with paper towels.  Heat remaining 2 tablespoons (28 grams) oil in a 12-inch skillet over medium-high heat until just smoking.  Brown steaks, 1 to 2 minutes per side.  Transfer to cutting board and slice into ½-inch-thick slices.  Serve with Scallion-Ginger Relish, if desired.

### Scallion-Ginger Relish

Makes about ½ cup.  We like the complexity of white pepper in this recipe; don't substitute black pepper.

6 scallions (100 grams), white and green parts separated and sliced thin
2 teaspoons (12 grams) grated fresh ginger
½ teaspoon (1 gram) ground white pepper
½ teaspoon (1 gram) grated lime zest plus 2 teaspoons (10 grams) juice
¼ cup (56 grams) vegetable oil
2 teaspoons (10 grams) soy sauce

Combine scallion whites, ginger, pepper, and lime zest in a heatproof bowl.  Heat oil in a small saucepan until shimmering.  Pour oil over scallion mixture.  (Mixture will bubble.)  Stir until well combined and let cool completely, about 15 minutes.  Stir in scallion greens, lime juice, and soy sauce.  Let mixture sit for 15 minutes to allow flavors to meld.  Serve.

### To Make Ahead

Steaks can be rapidly chilled in an ice bath and then refrigerated in a zipper-lock bag for up to 5 days.  To reheat, return sealed bag to water bath set to 140 °F / 60 °C for 30 minutes, then proceed with searing."""


SPIRAL_HAM = """1 7-pound (3.2 kilograms) spiral-sliced bone-in ham
½ cup (118 grams) ruby port
½ cup (160 grams) cherry preserves
1 cup packed (200 grams) dark brown sugar
Pepper

Using sous vide circulator, heat water to 140 °F (60 °C) in a 12-quart container.

Place ham into a 2-gallon zipper-lock freezer bag and seal bag, pressing out as much air as possible.  Gently lower bag into prepared water bath until ham is fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for at least 3 hours or up to 8 hours.

Cook port in small saucepan over medium heat until reduced to 2 tablespoons (35 grams), about 5 minutes.  Stir in cherry preserves, sugar, and 1 teaspoon (4 grams) pepper and cook, stirring occasionally, until sugar dissolves and mixture is thick, syrupy, and reduced to 1 cup, 5 to 10 minutes; set aside.

Adjust oven rack to lower-middle position and heat oven to 475 °F (246 °C).  Set wire rack in aluminum foil–lined rimmed baking sheet and spray with vegetable oil spray.  Transfer ham, cut side down, to prepared rack and brush with half of glaze.  Cook ham until glaze becomes sticky, 5 to 10 minutes.  Brush ham with remaining glaze and cook until glaze becomes sticky and light mahogany, 5 to 10 minutes.  Carve and serve.

### To Make Ahead

We don't recommend making this recipe ahead of time."""


HONEY_GLAZED_CARROTS = """1 pound (450 grams) carrots, peeled, halved lengthwise, and sliced ⅓ inch thick on bias
2 tablespoons (28 grams) unsalted butter, plus 2 tablespoons (28 grams) cut into 2 pieces and chilled
¼ cup (45 grams) chicken broth
2 tablespoons (42 grams) honey
4 teaspoons (20 grams) lemon juice
3 sprigs (1 gram) fresh thyme
Salt and pepper
2 tablespoons (4 grams) minced fresh chives

Using sous vide circulator, bring water to 190 °F (88 °C) in a 7-quart container.

Place carrots, 2 tablespoons (28 grams) butter, broth, honey, lemon juice, thyme sprigs, and ½ teaspoon (1.5 grams) salt in a 1-gallon zipper-lock freezer bag.  Seal bag, pressing out as much air as possible.  Place bag in a second 1-gallon zipper-lock freezer bag and seal.  Gently lower bags into prepared water bath, weight bag down (see page 14) until carrots are fully submerged, and then clip top corner of bag to side of water bath container, allowing remaining air bubbles to rise to top of bag.  Reopen 1 corner of zipper, release remaining air bubbles, and reseal bag.  Cover and cook for 1 to 2 hours.

Drain carrots through fine-mesh strainer set over 12-inch skillet; transfer carrots to bowl and discard thyme sprigs.  Bring cooking liquid to a simmer over medium-high heat and cook until reduced to 2 tablespoons (40 grams), 5 to 7 minutes.  Off heat, whisk in remaining 2 tablespoons chilled butter until mixture is smooth and glossy.  Add carrots and chives and toss to combine.  Season with salt and pepper to taste.  Serve.

### Variation: Honey-Ginger Glazed Carrots

Substitute 1 1-inch piece fresh ginger (12 grams), peeled and sliced thin, and ¼ teaspoon cayenne pepper for the thyme sprigs."""


# ── Recipe table: (id, title, subsection, body, tags) ─────────────────────
RECIPES = [
    ("sous-vide-foolproof-poached-chicken",  "Foolproof Poached Chicken",      "Chicken",
     POACHED_CHICKEN,
     ["sous-vide", "chicken", "poultry", "main", "easy"]),
    ("sous-vide-seared-duck-breasts",        "Seared Duck Breasts",            "Chicken",
     SEARED_DUCK,
     ["sous-vide", "duck", "poultry", "main"]),
    ("sous-vide-easy-boneless-turkey-breast","Easy Boneless Turkey Breast",    "Chicken",
     TURKEY_BREAST,
     ["sous-vide", "turkey", "poultry", "main"]),
    ("sous-vide-short-rib-pot-roast",        "Short Rib \"Pot Roast\"",         "Beef",
     SHORT_RIB,
     ["sous-vide", "beef", "main"]),
    ("sous-vide-peppercorn-crusted-roast-beef","Peppercorn-Crusted Roast Beef","Beef",
     PEPPERCORN_ROAST_BEEF,
     ["sous-vide", "beef", "main", "holiday"]),
    ("sous-vide-osso-buco",                  "Osso Buco",                       "Beef",
     OSSO_BUCO,
     ["sous-vide", "veal", "italian", "main"]),
    ("sous-vide-pork-tenderloin-steaks",     "Seared Pork Tenderloin Steaks",  "Pork",
     PORK_TENDERLOIN_STEAKS,
     ["sous-vide", "pork", "main"]),
    ("sous-vide-spiral-sliced-ham",          "Spiral-Sliced Ham",               "Pork",
     SPIRAL_HAM,
     ["sous-vide", "pork", "ham", "main", "holiday"]),
    ("sous-vide-honey-glazed-carrots",       "Honey-Glazed Carrots with Lemon and Thyme",
                                              "Veggies",
     HONEY_GLAZED_CARROTS,
     ["sous-vide", "vegetables", "carrots", "side"]),
]


def insertion_index(data, section, subsection):
    """Return the index AFTER the last existing recipe in (section, subsection)."""
    last = None
    for i, r in enumerate(data):
        if r["section"] == section and (r.get("subsection") or None) == subsection:
            last = i
    return (last + 1) if last is not None else len(data)


def make_entry(rid, title, subsection, body, tags):
    return {
        "id":         rid,
        "title":      title,
        "alt_title":  None,
        "section":    "Sous Vide",
        "subsection": subsection,
        "credit":     "America's Test Kitchen",
        "body":       body,
        "tags":       tags,
    }


def main():
    data = json.loads(JSON_PATH.read_text())
    by_id = {r["id"]: r for r in data}

    added, updated = 0, 0
    for rid, title, subsection, body, tags in RECIPES:
        entry = make_entry(rid, title, subsection, body, tags)
        existing = by_id.get(rid)
        if existing:
            existing.update(entry)
            updated += 1
            continue
        idx = insertion_index(data, "Sous Vide", subsection)
        data.insert(idx, entry)
        added += 1

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Added {added} new ATK sous vide recipes, refreshed {updated}.")


if __name__ == "__main__":
    main()
