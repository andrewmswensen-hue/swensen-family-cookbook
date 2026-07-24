#!/usr/bin/env python3
"""
Add 12 recipes that were silently missing from docs/recipes.json.

Root cause: the original parser skipped any bold heading whose title was
prefixed with an escaped asterisk (e.g. `**\*Recipe Name**`, which pandoc
generates when Word had an asterisk marker before the title).  These 12
recipes all sat in the source markdown but never made it into JSON.

They span Breads, Breakfast, and Desserts (Cookies, Brownies & Bars,
Cakes, Other Desserts).  Andrew flagged Mom's Heavenly Hot Fudge Sauce
specifically; the rest surfaced during the docx audit.

Idempotent — re-running just refreshes bodies.
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


def slug(s):
    s = s.lower().replace("'", "").replace("&", "and")
    s = re.sub(r"[^\w\s-]", "", s).strip()
    s = re.sub(r"[\s-]+", "-", s)
    return s.strip("-")


# ── The 12 recipes ────────────────────────────────────────────────────────

RECIPES = [
    # ── Breads ────────────────────────────────────────────────────────────
    {
        "title":  "Mom K's White Bread",
        "credit": "Tamara Kimball",
        "section": "Breads",
        "subsection": "Loaf & Quick Breads",
        "body": """2¾ cups warm water
1 Tbl yeast
6 Tbl oil
6 Tbl sugar
1 Tbl salt
7 cups flour

Combine water with yeast and 1 tsp sugar.  Allow yeast to bloom.  Add oil, sugar, salt, and 1 cup of flour.  Mix well.  Continue to add flour, 1 cup at a time, blending well after each addition.  Knead for 5 to 7 minutes.  Cover and allow to rise TWICE for 45 to 60 minutes each.  Form into 2 loaves of bread or 24 rolls and place in or on greased pans.  Allow dough to rise one more time.  Preheat oven to 350 degrees.  Bake the loaves 35 minutes or rolls 18 to 20 minutes.""",
        "tags": ["bread", "yeast", "baked"],
    },
    # ── Breakfast ─────────────────────────────────────────────────────────
    {
        "title":  "Granola",
        "credit": "Mom K",
        "section": "Breakfast",
        "subsection": None,
        "body": """6 cups rolled oats
½ cup wheat germ
1 cup raw sunflower seeds
1 cup sliced almonds
1 cup unsweetened coconut
1 tsp cinnamon
¼ cup butter
¼ cup coconut oil (or butter)
1 tsp vanilla
½ cup honey

Combine oats, wheat germ, sunflower seeds, almonds, coconut, and cinnamon in a large bowl and stir to mix completely.

Heat the butter, coconut oil, vanilla, and honey together in a saucepan.  Pour over the dry ingredients and mix well.

Pour onto a cookie sheet and bake at 310 degrees for 25 minutes, until it is all golden brown, flipping or stirring halfway through.  You want it to be crisp but not overly brown.""",
        "tags": ["breakfast", "granola", "baked", "oats"],
    },
    # ── Desserts › Cookies ───────────────────────────────────────────────
    {
        "title":  "Soft M&M Cookies",
        "credit": "Andrew",
        "section": "Desserts",
        "subsection": "Cookies",
        "body": """1 cup butter
1 cup brown sugar
1/3 cup white sugar
1 egg
1½ tsp vanilla
2¼ cups flour
½ tsp baking soda
½ tsp baking powder
1 tsp salt
M&Ms

Cream together the butter and sugars until fluffy.  Add vanilla and egg and beat until fluffy.  Combine the dry ingredients, then add slowly to the batter.  Stir in the M&Ms.

Bake at 350 degrees for about 10 minutes.  Do not over bake.  Makes about 2 dozen.""",
        "tags": ["cookies", "dessert", "chocolate", "baked", "easy"],
    },
    # ── Desserts › Brownies & Bars ───────────────────────────────────────
    {
        "title":  "JaNae's Best Brownies",
        "credit": "JaNae Swensen",
        "section": "Desserts",
        "subsection": "Brownies & Bars",
        "body": """1 cup butter
2 cups sugar
¼ tsp salt
1/3 cup cocoa
4 eggs
1½ cups flour
2 tsp vanilla

Cream the butter, sugar, salt, and cocoa.  Add the eggs one at a time, beating well after each addition.  Add the flour and vanilla.  DO NOT OVERMIX.

Bake in a 9x13 greased pan at 350 degrees for 30 to 40 minutes.  Check at 30 minutes and cook until just done.

Can also double the recipe and bake in a large cookie pan; check at 20 minutes for doneness.""",
        "tags": ["brownies", "dessert", "chocolate", "baked"],
    },
    {
        "title":  "Chocolate Chip Cream Cheese Bars",
        "credit": "Andrew",
        "section": "Desserts",
        "subsection": "Brownies & Bars",
        "body": """2 regular packages chocolate chip cookie dough
2 8-oz packages cream cheese, softened
1 cup sugar
2 eggs

Combine the cream cheese, sugar, and eggs and beat well.

Spread one package of cookie dough in a greased 9" x 13" cake pan.  Spread on the cream cheese mixture.  Drop flattened pieces of the other package of cookie dough on top of the cream cheese mixture (it will be mostly covered).

Bake at 350 degrees for about 30 minutes.  The cookie part should be lightly browned and the cream cheese filling should be just the littlest bit jiggly.  If you cook it until the filling is solid, it will be overdone.""",
        "tags": ["bars", "dessert", "chocolate", "cream cheese", "baked", "easy"],
    },
    # ── Desserts › Cakes ─────────────────────────────────────────────────
    {
        "title":  "Yellow Pound Cake",
        "credit": "Western Family",
        "section": "Desserts",
        "subsection": "Cakes",
        "body": """1 box Western Family yellow cake mix (use this brand!)
¾ cup vegetable oil
½ cup white sugar
4 large eggs, beaten well
1 cup sour cream (regular, light, or fat free)
1 tsp almond extract

Preheat oven to 350 degrees.  Grease a 12-cup Bundt pan.

In a large bowl, combine all ingredients and mix until blended.  Pour into the pan and bake for 45 to 50 minutes.  Cool before serving.

Serve with strawberries and whipped cream.""",
        "tags": ["cake", "dessert", "baked", "easy"],
    },
    # ── Desserts › Other Desserts ────────────────────────────────────────
    {
        "title":  "Homemade Peach Ice Cream",
        "credit": "Todd",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """4 eggs
2½ cups sugar
1 to 1½ Tbl vanilla
½ tsp salt
1 to 2 blenders full of fruit
1 pint whipping cream
1 quart half-n-half

Blend eggs, sugar, vanilla, and salt.  Pour into the ice cream tub.  Add fruit and stir.  Add cream and enough half-n-half to fill the freezer tub.

Turn on your ice cream maker and go for it!

Big Andrew uses 2 Tbl of English custard mix to replace the eggs.""",
        "tags": ["ice cream", "dessert", "peach", "fruit"],
    },
    {
        "title":  "Chewy Caramel Corn",
        "credit": "Jenifer Pullman",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """¾ cup brown sugar
¾ cup sugar
½ cup dark Karo syrup
½ cup water
1/8 tsp cream of tartar
½ cup butter
¼ tsp baking soda
1 batch air-popped popcorn

Cook the brown sugar, white sugar, Karo syrup, water, cream of tartar, and butter over medium heat until it reaches the soft ball stage.  Take off heat and add the baking soda.

Covers one batch of air-popped popcorn.""",
        "tags": ["popcorn", "caramel", "dessert", "snack", "candy"],
    },
    {
        "title":  "Microwave Caramel Corn",
        "credit": "Mom S. & Kris",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """1 cup unpopped popcorn kernels, popped
1½ cups brown sugar
¾ cup butter (1½ cubes)
1/3 cup white corn syrup
½ tsp baking soda

Melt the butter; stir in the sugar and corn syrup.  Put in the microwave for 3½ to 4 minutes or until boiling.  Cook on high for 2 minutes.  Add the baking soda and stir.

Pour over popped popcorn in a large paper bag.  Cook in the microwave on high 1½ minutes, shake, and cook 1½ minutes more.  Shake the bag well, then pour onto a cookie sheet to dry.""",
        "tags": ["popcorn", "caramel", "dessert", "snack", "microwave"],
    },
    {
        "title":  "Holly Wreaths",
        "credit": "Steph",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """36 large marshmallows
½ cup margarine
1½ tsp vanilla
1½ tsp green food coloring
5 cups corn flakes
Red hot candies (for decoration)

Melt the marshmallows and margarine.  Add the vanilla and food coloring.  Mix in the corn flakes and shape into wreaths.  Place on waxed paper.  Decorate with red hot candies for berries.""",
        "tags": ["holiday", "christmas", "no-bake", "kid-friendly", "dessert"],
    },
    {
        "title":  "Malted Pretzel Crunch",
        "credit": "Parselysagesweet.com",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """Recipe by Christina Tosi, via Epicurious.

Prep 10 min.  Cook 20 min.  Yields about 4 cups.

4 cups salted mini pretzels (about ½ of a 16-ounce bag)
½ cup tightly packed brown sugar
¼ cup granulated sugar
6 Tbl milk powder
¼ cup malted milk powder
½ tsp salt (optional — only if pretzels aren't salty enough)
14 Tbl butter (1 stick, plus 6 Tbl), melted

Preheat oven to 275 °F.

Pour the pretzels in a large bowl and crush them with your hands to one-quarter of their original size.  (Tip: throw them in a Ziplock bag and hammer them with a mallet — easier.)  Add the milk powder, malted milk powder, granulated sugar, brown sugar, and salt (if using) and toss to mix.  Pour the butter over the pretzel mix and toss to coat — as you toss, the butter acts as glue, binding the dry ingredients to the pretzels and creating small clusters.

Spread the clusters on a parchment- or silpat-lined sheet pan and bake for about 20 minutes, until it looks toasted, smells buttery, and crunches gently when you bite into it.

Cool completely before storing, eating, or using in a recipe.  Stored in an airtight container at room temperature, the crunch keeps 1 week.  In the fridge or freezer, 1 month.

### Notes

Malted milk powder is in the aisle with powdered milk, or the baking aisle.

Only add salt if your pretzels aren't salty enough — taste the mixture before baking to decide.

This would be fantastic in cookies with chocolate chunks, or drizzle melted chocolate over the top of the sheet of pretzel crunch, let it set, then break into pieces like toffee.""",
        "tags": ["snack", "dessert", "pretzels", "baked"],
    },
    {
        "title":  "Mom's Heavenly Hot Fudge Sauce",
        "credit": "Mom S.",
        "section": "Desserts",
        "subsection": "Other Desserts",
        "body": """2 (1-oz) squares of unsweetened baking chocolate
½ cup butter
3 cups sugar
1 (12-oz) can evaporated milk
½ tsp salt

Melt the butter and chocolate over low heat.  Gradually stir in the sugar.  Boil until the sugar dissolves.  Stir in the salt and milk.

Serve over ice cream, or store in the fridge.""",
        "tags": ["chocolate", "sauce", "dessert", "ice cream", "topping"],
    },
]


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

    added, refreshed = 0, 0
    for r in RECIPES:
        rid = f"{slug(r['section'])}-{slug(r['title'])}"
        entry = {
            "id":         rid,
            "title":      r["title"],
            "alt_title":  None,
            "section":    r["section"],
            "subsection": r["subsection"],
            "credit":     r["credit"],
            "body":       r["body"],
            "tags":       r["tags"],
        }
        existing = by_id.get(rid)
        if existing:
            existing.update(entry)
            refreshed += 1
        else:
            idx = insertion_index(data, r["section"], r["subsection"])
            data.insert(idx, entry)
            added += 1
            by_id[rid] = entry

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Added {added} new recipes, refreshed {refreshed} existing ones.")
    for r in RECIPES:
        sub = f" > {r['subsection']}" if r['subsection'] else ""
        print(f"  · {r['section']}{sub}: {r['title']}  (— {r['credit']})")


if __name__ == "__main__":
    main()
