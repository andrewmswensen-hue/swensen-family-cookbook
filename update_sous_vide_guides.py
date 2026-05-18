#!/usr/bin/env python3
"""
Update the bodies of the two Sous Vide guide entries:
  - "How to Sous Vide": add product links for supplies + ATK book link
  - "Meat Temperature Guide": append "(Add one hour if cooking from frozen.)"
    at the end of each meat paragraph

Links use markdown [text](url) syntax which the web app's renderInline()
turns into clickable anchors, and which build_docx.js turns into Word
ExternalHyperlink elements for the printable cookbook.

Idempotent: re-running just overwrites the two bodies with the latest text.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"

LINK_CIRCULATOR = "https://a.co/d/05FT9iV6"
LINK_CONTAINER  = "https://a.co/d/0b880e1k"
LINK_BAGS       = "https://a.co/d/08oJkQbn"
LINK_BAGS_DISP  = "https://a.co/d/0g2dcZN4"
LINK_VAC_SEALER = ("https://www.costco.com/p/-/foodsaver-preserve-vacuum-sealer-"
                   "appliance-with-bags-and-marinate-container/4201009385"
                   "?DM_PersistentCookieCreated=true&langId=-1")
LINK_ATK_BOOK   = "https://a.co/d/0ad3miMl"
LINK_SV_RACK    = "https://a.co/d/09TNT8uY"
LINK_SV_MAGNETS = "https://a.co/d/00QPz3CV"


HOW_TO_BODY = f"""### What is Sous Vide?

Sous vide (French for "under vacuum") is a method of cooking food sealed in a bag, submerged in a precisely temperature-controlled water bath. The water is heated to your target serving temperature — say 130 °F for medium-rare steak — and the food cooks gradually to exactly that temperature. Because the water never goes hotter than your target, the food cannot overcook.

### Why it's a game-changer

Impossible to overcook. Once your steak is at 130 °F, leaving it in for another hour still leaves it at 130 °F. The technique forgives you for forgetting it on the counter.

Juicier results, especially for lean meats. Chicken breast, pork chops, fish, and turkey are easy to dry out with conventional cooking. Sous vide keeps every fiber at the exact temperature it should be, edge to edge, never a degree higher.

Even cooking. No more gray overdone ring around a pink center — sous vide steak is medium-rare from crust to crust.

Hands-off. Drop it in, walk away, sear at the end.

### Basic supplies

A sous vide [immersion circulator]({LINK_CIRCULATOR}) — clips onto a pot and circulates the water at a set temperature. Popular brands: Anova, Joule, Inkbird.

A [pot or food-safe container]({LINK_CONTAINER}) — anything that holds 6 to 12 quarts of water. A standard stockpot works fine; insulated containers retain heat better.

Sealable bags — vacuum-sealer bags are ideal, but heavy-duty zip-top freezer bags work too. Use the water-displacement method: slowly lower the bag into water with the zipper open until the bag's air is squeezed out, then seal at the surface. Try these [reusable sous-vide bags]({LINK_BAGS}) or the [disposable version]({LINK_BAGS_DISP}).

For vacuum sealing, Andrew's favorite is [this FoodSaver from Costco]({LINK_VAC_SEALER}).

A way to sear at the end — a cast-iron skillet ripping hot, or a propane/butane torch. The interior comes out perfect from the sous vide; the crust comes from the post-cook sear.

### Basic workflow

Season your food. Drop it in a bag with any aromatics — butter, garlic, herbs.

Now seal the bag and get all the air out. You have two methods depending on what you're using.

If you're using a vacuum sealer, run the bag through it. The sealer pulls the air out and heat-seals the bag in one step. Once it's sealed, drop the whole bag straight into the water bath. This is the cleanest approach, especially for long cooks, because the seal is permanent.

If you're using a heavy-duty zip-top freezer bag or a reusable silicone bag, use the water-displacement method (sometimes called the Archimedes method): seal the bag almost all the way, leaving a small opening at one corner. Slowly lower the bag into the water bath with the opening above the surface. The water pressure pushes the air out through the gap. Just before the opening reaches the waterline, finish sealing it. Either way, make sure no water can get into the bag.

A note on floating: even with a good seal, food can release gas during long cooks (especially vegetables and tough cuts of meat), and the bag rises to the top. If any of the food pokes above the waterline it won't cook through. Two easy fixes — a [sous vide rack]({LINK_SV_RACK}) holds the bags vertical and submerged, or [silicone waterproof magnets]({LINK_SV_MAGNETS}) anchor the bag to the side or bottom of the container.

Heat your water bath to the target temperature using the circulator.

Once the bath is at temperature, lower the sealed bag in. Set a timer.

When the timer goes off, pull the bag out. Pat the meat dry — this is critical for a good sear.

Sear hard on a screaming-hot pan with a little oil and butter, 30 to 60 seconds per side, or torch the surface. Rest 5 minutes. Slice and serve.

### Where to learn more

America's Test Kitchen's [Sous Vide for Everybody]({LINK_ATK_BOOK}) is a great starting point — clear technique, tested recipes, and time/temperature tables for everything from eggs to short ribs."""


MEAT_TEMP_BODY = """Per America's Test Kitchen's tested sous vide times and temperatures. Add about 1 hour to any of these if the meat goes into the bath frozen.

### Chicken

150 °F (66 °C) for 90 minutes. Yields chicken breast that is fully cooked, safe, and remarkably juicy — the meat stays moist instead of drying out the way it does past 165 °F in a conventional oven. (Add one hour if cooking from frozen.)

### Pork chops

140 °F (60 °C) for 2 to 3 hours. Tender and rosy-pink throughout, never overdone. Sear hard at the end for the crust. (Add one hour if cooking from frozen.)

### Steak, medium rare

126 to 134 °F (52 to 57 °C) for 90 minutes up to 3 hours. Choose the lower end of the range for a deeper red center, the higher end for warm-pink edge to edge. Always sear hard at the end — a torch or smoking-hot cast iron is ideal. (Add one hour if cooking from frozen.)

### Cooking from frozen

Add about 1 hour to all times above. The food safely thaws and cooks through inside the temperature window — no need to thaw first.

### Always sear at the end

Sous vide gets the interior right. The crust comes from the sear. Pat the meat dry, then sear in a screaming-hot pan with oil for 30 to 60 seconds per side, or use a propane torch on the surface."""


def main():
    data = json.loads(JSON_PATH.read_text())
    updates = {
        "sous-vide-how-to-sous-vide": HOW_TO_BODY,
        "sous-vide-meat-temperature-guide": MEAT_TEMP_BODY,
    }
    found = 0
    for r in data:
        if r["id"] in updates:
            r["body"] = updates[r["id"]]
            found += 1
            print(f"  Updated {r['id']}")
    if found != len(updates):
        raise RuntimeError(f"Only found {found} of {len(updates)} guides")

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {found} guide bodies.")


if __name__ == "__main__":
    main()
