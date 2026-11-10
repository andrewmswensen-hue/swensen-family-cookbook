"""Add hand-checked "cook mode" data to recipes in docs/recipes.json.

Cook mode works on every recipe automatically by reading the recipe text.
A `cook` block is only needed when the automatic version isn't good enough:
it lets us set clean step titles, exact timers, which ingredients go with
which step, and "look for" cues.  Anything left out of a step is still
worked out automatically.

Schema (all fields optional):

  "cook": {
    "servings": 4,                    # number -> cook mode shows a Serves stepper
    "yield": "Makes 2 loaves",        # display text only (no stepper)
    "ingredients": [                  # leave out to use the recipe's own list
      {"id": "flour", "qty": 2.25, "unit": "cups", "item": "flour"},
      {"id": "salt", "item": "Salt and pepper"}          # no qty = never scaled
    ],
    "steps": [
      {
        "title": "Make the dough",
        "text": "Exact step text, taken from the recipe.",
        "ingredients": ["flour", "salt"],               # ids from the list above
        "timer": 600,                                     # seconds, or
        # "timer": {"min": 2400, "max": 3000, "label": "Roast"},   a range, or
        # "timer": [ {...}, {...} ],                       several, or
        # "timer": null                                     no timer at all
        "cue": "Golden brown",          # "Look for:" line (from the recipe text only)
        "batchNote": "..."              # shown only when the batch is scaled up
      }
    ]
  }

Rules: step text, cues and batch notes come only from the recipe (or its
original source).  Never invent cooking facts.

Run:  python3 add_cook_data.py      (safe to re-run; it replaces the blocks below)
"""
import json
from pathlib import Path

JSON_PATH = Path(__file__).parent / "docs" / "recipes.json"

COOK_DATA = {
    # America's Test Kitchen. Test recipe for cook mode's explicit-data path.
    "sous-vide-crispy-smashed-potatoes": {
        "ingredients": [
            {"id": "potatoes", "qty": 2, "unit": "pounds", "item": "small red potatoes, scrubbed"},
            {"id": "broth", "qty": 0.5, "unit": "cup", "item": "chicken broth"},
            {"id": "salt-pepper", "item": "Salt and pepper"},
            {"id": "oil", "qty": 6, "unit": "Tbl", "item": "vegetable oil"},
            {"id": "rosemary", "qty": 1, "unit": "Tbl", "item": "chopped fresh rosemary"},
            {"id": "garlic", "qty": 3, "item": "garlic cloves, minced"},
        ],
        "steps": [
            {
                "title": "Heat the water bath",
                "text": "Heat the water bath to 194 °F.",
                "ingredients": [],
                "timer": None,
            },
            {
                "title": "Sous vide the potatoes",
                "text": "Combine the potatoes, broth, and ¾ tsp salt in a 1-gallon zip-top freezer bag. "
                        "Seal and double-bag. Lower into the water bath, keeping the bag fully submerged "
                        "(use a rack or magnets if it tries to float). Cook for 60 to 75 minutes.",
                "ingredients": ["potatoes", "broth", "salt-pepper"],
                "timer": {"min": 3600, "max": 4500, "label": "Sous vide potatoes"},
            },
            {
                "title": "Make the garlic-rosemary oil",
                "text": "Adjust an oven rack to upper-middle position and heat the oven to 450 °F. "
                        "In a microwave-safe bowl, microwave the oil, rosemary, and garlic, stirring "
                        "occasionally, until the garlic begins to brown, 2 to 4 minutes. Strain into a "
                        "large bowl, reserving the garlic and rosemary.",
                "ingredients": ["oil", "rosemary", "garlic"],
                "timer": {"min": 120, "max": 240, "label": "Garlic oil"},
                "cue": "The garlic begins to brown.",
            },
            {
                "title": "Dry and smash the potatoes",
                "text": "Drain the potatoes and let them sit until the surfaces are dry, about 10 minutes. "
                        "Add the potatoes and ½ tsp salt to the bowl with the herb oil and toss. Arrange "
                        "the potatoes on a rimmed baking sheet, place a second baking sheet on top, and "
                        "press firmly to flatten each potato to ⅓ to ½ inch thick. Remove the top sheet.",
                "ingredients": ["potatoes", "salt-pepper"],
                "timer": {"min": 600, "label": "Potatoes drying"},
                "cue": "The surfaces are dry.",
            },
            {
                "title": "Roast until crisp",
                "text": "Roast for 40 to 50 minutes, flipping halfway through, until the potatoes are "
                        "crisp and well browned.",
                "ingredients": [],
                "timer": [
                    {"min": 1200, "max": 1500, "label": "Flip the potatoes"},
                    {"min": 2400, "max": 3000, "label": "Roast potatoes"},
                ],
                "cue": "Crisp and well browned.",
            },
            {
                "title": "Toss and serve",
                "text": "Transfer to a serving bowl, add the reserved garlic and rosemary, and gently "
                        "toss to combine. Season with salt and pepper to taste. Serve.",
                "ingredients": ["salt-pepper"],
                "timer": None,
            },
        ],
    },
}


def main():
    data = json.loads(JSON_PATH.read_text())
    by_id = {r["id"]: r for r in data}
    for rid, cook in COOK_DATA.items():
        if rid not in by_id:
            raise SystemExit(f"Recipe not found: {rid}")
        recipe = by_id[rid]
        if recipe.get("_source_id"):
            raise SystemExit(f"{rid} is a cross-listing; add cook data to {recipe['_source_id']} instead")
        ids = {i["id"] for i in cook.get("ingredients", [])}
        for step in cook.get("steps", []):
            missing = [i for i in step.get("ingredients", []) if ids and i not in ids]
            if missing:
                raise SystemExit(f"{rid}: step '{step.get('title')}' uses unknown ingredient ids {missing}")
        recipe["cook"] = cook
        print(f"cook data set: {rid} ({len(cook.get('steps', []))} steps)")
    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
