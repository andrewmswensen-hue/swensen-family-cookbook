#!/usr/bin/env python3
"""
Replace the four Sous Vide placeholder recipes with real ones, and add three
ATK veggie recipes (beets, asparagus, smashed potatoes).

Idempotent — re-running just refreshes the bodies.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"

LINK_BIGPAPAS = "https://a.co/d/0j8JB0d6"
LINK_SPADEL_BEEF = "https://a.co/d/0e6Bz0Cu"


# ── Andrew's three meat recipes ───────────────────────────────────────────

TRI_TIP_BODY = f"""1 whole tri-tip (Costco is a great source)
2 to 3 Tbl steak seasoning of choice (see notes)
1 Tbl butter, for searing

For the seasoning, Andrew likes [Big Papa's Double Secret Steak Seasoning]({LINK_BIGPAPAS}) or [Spade L Beef Seasoning]({LINK_SPADEL_BEEF}).

If you'd like, cut the tri-tip into two equal pieces by weight. Half feeds one to two people; the whole tri-tip serves three to four.

Cover the meat generously with seasoning on all sides. Place it in a vacuum-seal bag or zip-top freezer bag, sealing per the workflow in the [How to Sous Vide guide](#/recipe/sous-vide-how-to-sous-vide/basic-workflow).

Sous vide at 132 °F for a good medium-rare, or 140 °F for medium. Two to four hours is plenty; six hours is even better. Add one hour if cooking from frozen.

To finish, pat the meat dry and sear hard — on a screaming-hot grill, or in a cast-iron pan with butter, about 45 to 60 seconds per side and on each edge. Slice against the grain to serve."""


CHICKEN_BODY = """2 to 4 chicken breasts, marinated as you like
1 Tbl butter or oil, for searing

Andrew's shortcut is to grab a tray of pre-marinated raw chicken from Harmon's. Otherwise, take plain chicken breasts and marinate them in whatever sauce you love — Italian dressing, teriyaki, lemon-herb, anything goes — for a few hours or overnight.

Place the chicken in a vacuum-seal bag or zip-top freezer bag, sealing per the workflow in the [How to Sous Vide guide](#/recipe/sous-vide-how-to-sous-vide/basic-workflow).

Sous vide at 150 °F for 90 minutes. Add one hour if cooking from frozen.

To finish, pat dry and sear in a screaming-hot pan, cast-iron, or on the grill — about 60 seconds per side. Go a little longer if you want more pronounced grill marks."""


PORK_BODY = """2 to 4 pork chops, about 1 inch thick
Marinade or dry rub of choice (see notes)
1 Tbl butter or oil, for searing

Andrew's favorite marinade is Newman's Own Balsamic Vinaigrette; for a dry rub, Spade L Pork seasoning works great. Coat the pork chops generously in your chosen marinade or rub. Place the chops in a vacuum-seal bag or zip-top freezer bag, sealing per the workflow in the [How to Sous Vide guide](#/recipe/sous-vide-how-to-sous-vide/basic-workflow).

Sous vide at 140 °F for 2 to 4 hours. Add one hour if cooking from frozen.

Pat dry and finish on a screaming-hot grill or in a cast-iron pan, about 60 seconds per side. The result is a chop that's edge-to-edge tender and juicier than anything you'd get on the grill alone."""


# ── Three ATK veggie recipes (condensed from the cookbook scans) ───────────

BEETS_BODY = """2 pounds beets, trimmed
3 Tbl extra-virgin olive oil
2 Tbl sherry vinegar
4 sprigs fresh thyme
Salt and pepper
2 Tbl minced fresh chives

Heat the water bath to 191 °F.

In a bowl, toss the beets with olive oil, vinegar, thyme, 1¼ tsp salt, and ¾ tsp pepper. Place the mixture in a 1-gallon zip-top freezer bag, pressing out as much air as possible. Drop that bag inside a second 1-gallon zip-top freezer bag — double-bagging protects against seam failure on long cooks. Use the water-displacement method to remove the remaining air, then seal.

Lower the bag into the water bath. Beets float, so weight them down with a sous vide rack or silicone magnets so they stay fully submerged. Cook for 4 to 6 hours.

Transfer the beets to a cutting board and pour the cooking liquid into a large bowl. Discard the thyme sprigs. When the beets are cool enough to handle, rub the skins off with a paper towel and cut into ½-inch wedges. Add the beets and chives to the bowl with the cooking liquid and toss. Season with salt and pepper. Serve.

### Make ahead

Cooked beets can be chilled in an ice bath and refrigerated for up to 7 days. Bring to room temperature before serving."""


ASPARAGUS_BODY = """2 pounds thick asparagus, trimmed
1 tomato, cored, seeded, and chopped fine (about ¾ cup)
1 shallot, minced
1½ Tbl lemon juice
1 Tbl chopped fresh basil
3 Tbl extra-virgin olive oil
Salt and pepper

Heat the water bath to 180 °F.

Arrange the asparagus in a single layer in a 1-gallon zip-top freezer bag and seal, pressing out as much air as possible. Double-bag for safety. Lower the bag into the water bath. Asparagus has a tendency to float — make sure it stays fully submerged, using a rack or magnets if needed.

Cook for 20 minutes.

While the asparagus cooks, whisk the tomato, shallot, lemon juice, basil, olive oil, and ¼ tsp salt in a bowl. Season with salt and pepper to taste.

Transfer the asparagus to a serving platter and drizzle with the vinaigrette. Serve.

### Variations

**Soy-Ginger Vinaigrette** — Substitute 2 minced scallions (¼ cup) and 3 Tbl lime juice for the tomato and basil. Add 1 Tbl sesame oil, 2 Tbl soy sauce, 1 Tbl honey, 1 Tbl grated fresh ginger, and 2 minced garlic cloves.

**Mustard-Thyme Vinaigrette** — Substitute 1 Tbl chopped fresh thyme and ¼ tsp Dijon mustard for the tomato and basil."""


POTATOES_BODY = """2 pounds small red potatoes, scrubbed
½ cup chicken broth
Salt and pepper
6 Tbl vegetable oil
1 Tbl chopped fresh rosemary
3 garlic cloves, minced

Heat the water bath to 194 °F.

Combine the potatoes, broth, and ¾ tsp salt in a 1-gallon zip-top freezer bag. Seal and double-bag. Lower into the water bath, keeping the bag fully submerged (use a rack or magnets if it tries to float). Cook for 60 to 75 minutes.

Adjust an oven rack to upper-middle position and heat the oven to 450 °F. In a microwave-safe bowl, microwave the oil, rosemary, and garlic, stirring occasionally, until the garlic begins to brown — 2 to 4 minutes. Strain into a large bowl, reserving the garlic and rosemary.

Drain the potatoes and let them sit until the surfaces are dry, about 10 minutes. Add the potatoes and ½ tsp salt to the bowl with the herb oil and toss. Arrange the potatoes on a rimmed baking sheet, place a second baking sheet on top, and press firmly to flatten each potato to ⅓ to ½ inch thick. Remove the top sheet.

Roast for 40 to 50 minutes, flipping halfway through, until the potatoes are crisp and well browned. Transfer to a serving bowl, add the reserved garlic and rosemary, and gently toss to combine. Season with salt and pepper to taste. Serve."""


# ── Map id → updated fields ────────────────────────────────────────────────

UPDATES = {
    "sous-vide-tri-tip": {
        "title": "Sous Vide Tri-Tip",
        "credit": "Andrew",
        "body": TRI_TIP_BODY,
        "tags": ["sous-vide", "beef", "main", "easy"],
    },
    "sous-vide-marinated-chicken-breast": {
        "title": "Sous Vide Marinated Chicken Breast",
        "credit": "Andrew",
        "body": CHICKEN_BODY,
        "tags": ["sous-vide", "chicken", "poultry", "main", "easy"],
    },
    "sous-vide-pork-chops": {
        "title": "Juicy Sous Vide Pork Chops",
        "credit": "Andrew",
        "body": PORK_BODY,
        "tags": ["sous-vide", "pork", "main", "easy"],
    },
}


NEW_VEGGIE_RECIPES = [
    {
        "id": "sous-vide-better-than-braised-beets",
        "title": "Better-Than-Braised Beets",
        "alt_title": None,
        "section": "Sous Vide",
        "subsection": "Veggies",
        "credit": "America's Test Kitchen",
        "body": BEETS_BODY,
        "tags": ["sous-vide", "vegetables", "beets", "side"],
    },
    {
        "id": "sous-vide-perfect-asparagus",
        "title": "Perfect Asparagus with Tomato-Basil Vinaigrette",
        "alt_title": None,
        "section": "Sous Vide",
        "subsection": "Veggies",
        "credit": "America's Test Kitchen",
        "body": ASPARAGUS_BODY,
        "tags": ["sous-vide", "vegetables", "asparagus", "side"],
    },
    {
        "id": "sous-vide-crispy-smashed-potatoes",
        "title": "Crispy Smashed Potatoes",
        "alt_title": None,
        "section": "Sous Vide",
        "subsection": "Veggies",
        "credit": "America's Test Kitchen",
        "body": POTATOES_BODY,
        "tags": ["sous-vide", "vegetables", "potatoes", "side"],
    },
]


def main():
    data = json.loads(JSON_PATH.read_text())

    # 1. Update the three meat placeholders in place
    updated = []
    for r in data:
        if r["id"] in UPDATES:
            fields = UPDATES[r["id"]]
            r.update(fields)
            updated.append(r["id"])

    # 2. Remove the Carrots placeholder
    before = len(data)
    data = [r for r in data if r["id"] != "sous-vide-carrots"]
    removed_count = before - len(data)

    # 3. Insert the three veggie recipes after the existing Sous Vide entries.
    #    Find the position just after the last "Sous Vide" section recipe.
    existing_ids = {r["id"] for r in data}
    veggies_to_add = [r for r in NEW_VEGGIE_RECIPES if r["id"] not in existing_ids]

    if veggies_to_add:
        last_sv_idx = max(
            (i for i, r in enumerate(data) if r["section"] == "Sous Vide"),
            default=None,
        )
        if last_sv_idx is None:
            raise RuntimeError("Couldn't find existing Sous Vide entries")
        data = data[: last_sv_idx + 1] + veggies_to_add + data[last_sv_idx + 1 :]

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    print(f"Updated {len(updated)} meat recipes: {', '.join(updated)}")
    print(f"Removed {removed_count} placeholder (carrots)")
    print(f"Added {len(veggies_to_add)} veggie recipes: {', '.join(v['id'] for v in veggies_to_add)}")


if __name__ == "__main__":
    main()
