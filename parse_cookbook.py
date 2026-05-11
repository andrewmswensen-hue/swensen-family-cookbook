#!/usr/bin/env python3
"""
Parse the raw markdown extract of the Swensen family cookbook into a structured
JSON inventory: one entry per recipe, with section/subsection, credit, body,
and auto-generated search tags.

Run: python3 parse_cookbook.py
Input:  cookbook_raw.md
Output: recipes.json  (machine-readable)
        recipes_inventory.md  (human-readable inventory)
"""

import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "cookbook_raw.md"

# Top-level section names and their subsection groupings.
# Each entry: heading-text-in-doc -> (section, subsection_or_None)
SECTION_MAP = {
    "Appetizers":                   ("Appetizers", None),
    "Beverages":                    ("Beverages", None),
    "Breads":                       ("Breads", None),
    "Soups":                        ("Soups", None),
    "Salads":                       ("Salads", None),
    "Sandwiches":                   ("Sandwiches", None),
    "Vegetables":                   ("Vegetables & Sides", None),
    "Side Dishes":                  ("Vegetables & Sides", None),
    "Rice, Beans":                  ("Rice, Beans & Pasta", None),
    "Pasta":                        ("Rice, Beans & Pasta", None),
    "Main Dishes:":                 ("Main Dishes", None),  # parent marker
    "Beef":                         ("Main Dishes", "Beef"),
    "Chicken & Turkey":             ("Main Dishes", "Chicken & Turkey"),
    "Pork / Sausage":               ("Main Dishes", "Pork & Sausage"),
    "Sea Food":                     ("Main Dishes", "Seafood"),
    "Breakfast":                    ("Breakfast", None),
    "Desserts:":                    ("Desserts", None),  # parent marker
    "Cookies":                      ("Desserts", "Cookies"),
    "Brownies & Bars":              ("Desserts", "Brownies & Bars"),
    "Cakes":                        ("Desserts", "Cakes"),
    "Pies":                         ("Desserts", "Pies"),
    "Other Desserts":               ("Desserts", "Other Desserts"),
    "Snacks":                       ("Desserts", "Other Desserts"),
    "Kid's Stuff":                  ("Kid's Stuff", None),
    "Substitutions":                ("Kitchen Reference", "Substitutions"),
    "High Altitude Baking Tips":    ("Kitchen Reference", "High Altitude Baking"),
    "Measurement Equivalents":      ("Kitchen Reference", "Measurement Equivalents"),
}

# Known sub-component labels inside a recipe (we treat these as part of the
# current recipe's body, not as a new recipe).  These are detected by trailing
# colon in practice, but we also list common ones for safety.
KNOWN_COMPONENTS = {
    "dough", "filling", "sauce", "glaze", "frosting", "crust", "topping",
    "dressing", "marinade", "icing", "salad", "chicken", "beef", "pork",
    "meatballs", "cake", "cookies", "soup", "base", "noodles", "toppings",
    "ingredients", "method", "directions", "instructions", "rice bowl",
    "pickled veggies", "sriracha mayo", "for the bowls", "for the topping",
    "lemon", "lime", "spicy rub", "balsamic glaze", "marinade ", "garnish",
    "lemongrass rice", "marinated veggies", "burgers", "cookies:", "filling",
    "dry rub", "braising liquid", "cake mix", "creamy glaze", "bottom crust",
    "oatmeal bottom", "chocolate topping", "ice cream", "whipped vanilla frosting",
    "cinnamon-sugar", "quick mango salsa", "tacos", "cilantro lime dressing",
}

# Note: "cream cheese frosting" appears both as a component (when followed by ':')
# and as a standalone recipe near the end of the dessert section.  We rely on the
# trailing-colon heuristic to disambiguate — do NOT add it to KNOWN_COMPONENTS.

# These bolded lines look like recipe titles but are inline subheaders
# embedded in a recipe's body (no colon, but functionally a component).
# We hand-list the obvious ones detected during the survey.
INLINE_COMPONENT_OVERRIDES = {
    "Lemon Sauce",
    "Orange Sauce",
    "Honey Butter",
    "Maple Glaze",
    "Buttermilk Syrup",
    "Alfredo Sauce",
    "Teriyaki Sauce",
    "Lemonade-Mustard Sauce",
    "Gravy from NO Drippings",
    "Turkey Brine",
    "INSTRUCTIONS",
    "Ingredients",
    "Glaze",
    "Whipped Vanilla Frosting",
    "Shallot Vinaigrette",
    "Cream Cheese Frosting (Steph's recipe):",
    "Orzo",                 # accompaniment to Chicken Saltimboca
    "Prepping",             # step header inside Super Easy Meatless Enchiladas
    "Rice, Beans",          # split section heading
    "Pasta",                # split section heading (joined with above)
    "1 cup dry beans = 2 -- 2 ½ cups cooked",  # reference fragment
}

# Tag dictionary for keyword-based auto-tagging.
TAG_RULES = [
    # (regex, tags)
    (r"\bchicken\b",          ["chicken", "poultry"]),
    (r"\bturkey\b",           ["turkey", "poultry"]),
    (r"\bbeef\b|\bsteak\b|\bground beef\b|\broast\b",  ["beef"]),
    (r"\bpork\b|\bsausage\b|\bham\b|\bbacon\b|pancetta",      ["pork"]),
    (r"\bsalmon\b|\bhalibut\b|\btuna\b|\borange roughy\b|\bfish\b|\bclam\b|\bshrimp\b|\bseafood\b",
                              ["seafood"]),
    (r"\bvegetarian\b",       ["vegetarian"]),
    (r"\bgluten[- ]free\b",   ["gluten-free"]),
    (r"\btaco\b|\benchilada\b|\bsalsa\b|\bguacamole\b|carne asada|\bquesadilla\b|carnitas|tomatillo",
                              ["mexican"]),
    (r"\bthai\b|pad thai|sriracha|huli|miso|teriyaki|gyoza|wonton|bahn mi|banh mi|drunken zucchini",
                              ["asian"]),
    (r"\bkorean\b",           ["korean"]),
    (r"\bitalian\b|\bpasta\b|\bravioli\b|\bspaghetti\b|\blasagna\b|\bpolenta\b|\bsaltimboca\b|\bmarsala\b|\bpiccata\b",
                              ["italian"]),
    (r"\bgreek\b|gyro",       ["greek"]),
    (r"\bicelandic\b",        ["icelandic"]),
    (r"\bvietnam(?:ese)?\b",  ["vietnamese"]),
    (r"\bgrill",              ["grilled"]),
    (r"\bbaked?\b|\boven\b",  ["baked"]),
    (r"\bfried?\b|\bdeep fr|\bpan[- ]fr",       ["fried"]),
    (r"\bcrock[- ]?pot|\bslow cooker|\bpressure cooker|instant pot",
                              ["slow-cooker"]),
    (r"\bcasserole\b",        ["casserole"]),
    (r"\bsoup\b|chowder",     ["soup"]),
    (r"\bsalad\b",            ["salad"]),
    (r"\bsandwich\b|panini",  ["sandwich"]),
    (r"\bchocolate\b",        ["chocolate"]),
    (r"\bcaramel\b",          ["caramel"]),
    (r"\bpumpkin\b",          ["pumpkin"]),
    (r"\bpeanut butter\b",    ["peanut-butter"]),
    (r"\bcheesecake\b",       ["cheesecake"]),
    (r"\bcookie\b",           ["cookie"]),
    (r"\bbrownie\b",          ["brownie"]),
    (r"\bcake\b|cupcake",     ["cake"]),
    (r"\bpie\b",              ["pie"]),
    (r"\bjam\b",              ["jam"]),
    (r"\bbread\b|biscuit|scone|roll|muffin",     ["bread"]),
    (r"\bcorn[ -]?bread\b",   ["cornbread"]),
    (r"\bbreakfast\b|pancake|waffle|granola|oatmeal|burrito|scramble",  ["breakfast"]),
    (r"\bappetizer\b|\bdip\b|\bfondue\b|wing",   ["appetizer"]),
    (r"\bdrink\b|punch|limeade|lemonade",        ["drink"]),
    (r"\bkid",                ["kid-friendly"]),
    (r"\bvegetable\b|broccoli|carrot|brussels|cauliflower|asparagus|zucchini|potato|polenta|sprouts|mushroom|onion|beans|green bean",
                              ["vegetables"]),
    (r"holiday|easter|christmas|thanksgiving",   ["holiday"]),
    (r"\bbeet\b",             ["beets"]),
    (r"\borange\b",           ["citrus"]),
    (r"\blemon\b|\blime\b",   ["citrus"]),
    (r"\bcoconut\b",          ["coconut"]),
    (r"\bcheese\b",           ["cheese"]),
    (r"\bspicy\b|sriracha|jalape|chili|chipotle",["spicy"]),
    (r"\bquick\b|easy|one[- ]?skillet|one pan",  ["easy"]),
    (r"\bcrunchy|crispy",     ["crispy"]),
]

# Sections that pair with auto-tags
SECTION_TAGS = {
    "Appetizers": ["appetizer"],
    "Beverages": ["drink"],
    "Breads": ["bread"],
    "Soups": ["soup"],
    "Salads": ["salad"],
    "Sandwiches": ["sandwich"],
    "Vegetables & Sides": ["side", "vegetables"],
    "Rice, Beans & Pasta": ["side"],
    "Breakfast": ["breakfast"],
    "Kid's Stuff": ["kid-friendly", "craft"],
    "Kitchen Reference": ["reference"],
}

SUBSECTION_TAGS = {
    "Beef": ["beef", "main"],
    "Chicken & Turkey": ["chicken", "poultry", "main"],
    "Pork & Sausage": ["pork", "main"],
    "Seafood": ["seafood", "main"],
    "Cookies": ["cookie", "dessert"],
    "Brownies & Bars": ["brownie", "dessert"],
    "Cakes": ["cake", "dessert"],
    "Pies": ["pie", "dessert"],
    "Other Desserts": ["dessert", "snack"],
    "Candy": ["candy", "dessert", "snack"],
    "Frostings & Icings": ["frosting", "dessert"],
}


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[-\s]+", "-", text)
    return text


def is_bold_line(line):
    """True if the line is purely a **bold** heading."""
    return bool(re.match(r"^\*\*[^*]+\*\*\s*$", line.strip()))


def strip_bold(line):
    m = re.match(r"^\*\*(.+?)\*\*\s*$", line.strip())
    return m.group(1).strip() if m else line.strip()


# Lines that look bold but are pandoc artifacts or stray fragments — skip entirely
JUNK_PATTERNS = [
    r"^\\?$",                       # \ or empty
    r"^&$",                         # stray ampersand
    r"^.{1,2}$",                    # one or two-char fragments
    r"^Serve with .+\\$",           # accidentally-bolded sentence ending in \
]
JUNK_RES = [re.compile(p) for p in JUNK_PATTERNS]


def is_junk_heading(text):
    return any(r.match(text) for r in JUNK_RES)


def is_italic_credit(line):
    """True if line is a *credit* line in italics, single short phrase."""
    s = line.strip()
    m = re.match(r"^\*([^*]+)\*\s*$", s)
    if not m:
        return False
    inner = m.group(1).strip()
    # Credits are short and look like names/sources, not sentences.
    # Allow trailing periods (e.g. "Mom K.", "Mom S.") but reject anything
    # that looks like a real sentence (contains a period followed by a space).
    if len(inner) > 80:
        return False
    if ". " in inner:
        return False
    return True


def strip_italic(line):
    m = re.match(r"^\*(.+?)\*\s*$", line.strip())
    return m.group(1).strip() if m else line.strip()


HASH_RECIPE_RE = re.compile(r"^#######\s+(?!#)(.+)$")     # `####### Recipe`
HASH_CREDIT_RE = re.compile(r"^########\s+(.+)$")         # `######## Credit`
HASH_SUBSEC_RE = re.compile(r"^######\s+\*\*(.+?)\*\*\s*$")  # `###### **Candy**`


def looks_like_subheader(text):
    """True if a bolded line is a component subheader (e.g., 'Sauce:', 'Dough:')."""
    t = text.strip().rstrip(":").lower()
    if text.strip().endswith(":"):
        return True
    if t in KNOWN_COMPONENTS:
        return True
    if text.strip() in INLINE_COMPONENT_OVERRIDES:
        return True
    return False


def auto_tags(recipe):
    """Generate auto-tags from section, subsection, title, and body text."""
    tags = set()
    if recipe["section"] in SECTION_TAGS:
        tags.update(SECTION_TAGS[recipe["section"]])
    if recipe.get("subsection") in SUBSECTION_TAGS:
        tags.update(SUBSECTION_TAGS[recipe["subsection"]])

    haystack = (recipe["title"] + " " + recipe["body"]).lower()
    for pattern, taglist in TAG_RULES:
        if re.search(pattern, haystack):
            tags.update(taglist)
    return sorted(tags)


def parse(raw_text):
    lines = raw_text.splitlines()
    recipes = []
    current = None
    section = None
    subsection = None

    def flush():
        if current is not None:
            body = current["body"]
            # Remove stray pandoc bold-fragment artifacts from the body
            body = re.sub(r"(?m)^\*?\*?\\\*?\*?\s*$", "", body)
            # Collapse 3+ blank lines into a single blank line
            body = re.sub(r"\n{3,}", "\n\n", body).strip()
            current["body"] = body
            current["tags"] = auto_tags(current)
            recipes.append(current)

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Malformed pandoc bold pattern: `**\` on one line, then `Title**` on the next.
        # Treat the `Title**` line as a recipe heading.
        if stripped.endswith("**") and not stripped.startswith("**"):
            title_candidate = stripped[:-2].strip()
            # Sanity check — must look like a recipe title (starts with a capital,
            # short-ish, no obvious sentence punctuation).
            looks_like_title = (
                title_candidate
                and title_candidate[0].isupper()
                and len(title_candidate) < 80
                and ". " not in title_candidate
            )
            if looks_like_title:
                flush()
                credit = None
                j = i + 1
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                if j < len(lines) and is_italic_credit(lines[j]):
                    credit = strip_italic(lines[j])
                    next_idx = j + 1
                else:
                    next_idx = i + 1
                # Special-case Royal Icing → Frostings & Icings subsection
                use_sub = subsection
                if title_candidate == "Royal Icing Glaze for Gingerbread Houses":
                    use_sub = "Frostings & Icings"
                current = {
                    "id":         slugify(f"{section or 'misc'}-{title_candidate}")[:80],
                    "title":      title_candidate,
                    "alt_title":  None,
                    "section":    section or "Uncategorized",
                    "subsection": use_sub,
                    "credit":     credit,
                    "body":       "",
                }
                i = next_idx
                continue

        # Hash-prefixed sub-section header (e.g. "###### **Candy**" inside Desserts)
        m = HASH_SUBSEC_RE.match(stripped)
        if m:
            heading = m.group(1).strip()
            # Treat as subsection only if we're inside a known section
            if section == "Desserts" and heading.lower() in {"candy"}:
                flush()
                current = None
                subsection = "Candy"
                i += 1
                continue

        # Hash-prefixed recipe heading
        m = HASH_RECIPE_RE.match(stripped)
        if m:
            title = m.group(1).strip()
            if title:
                flush()
                credit = None
                j = i + 1
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                cred_match = HASH_CREDIT_RE.match(lines[j].strip()) if j < len(lines) else None
                if cred_match:
                    credit = cred_match.group(1).strip()
                    next_idx = j + 1
                elif j < len(lines) and is_italic_credit(lines[j]):
                    credit = strip_italic(lines[j])
                    next_idx = j + 1
                else:
                    next_idx = i + 1
                current = {
                    "id":         slugify(f"{section or 'misc'}-{title}")[:80],
                    "title":      title,
                    "alt_title":  None,
                    "section":    section or "Uncategorized",
                    "subsection": subsection,
                    "credit":     credit,
                    "body":       "",
                }
                i = next_idx
                continue

        # Hash-prefixed credit (e.g. "######## Grandma Ida") attached to a previously-found
        # bold-style recipe heading like "**Divinity**"
        m = HASH_CREDIT_RE.match(stripped)
        if m:
            if current is not None and not current.get("credit"):
                current["credit"] = m.group(1).strip()
            i += 1
            continue

        if is_bold_line(line):
            heading = strip_bold(line)

            # Skip pandoc artifact fragments
            if is_junk_heading(heading):
                i += 1
                continue

            # Stop processing recipes when we hit the reference section at end of doc.
            # That content (Substitutions, High Altitude Baking) is handled separately.
            if heading == "Substitutions":
                flush()
                current = None
                break

            # Is this a top-level section?
            if heading in SECTION_MAP:
                flush()
                current = None
                section, subsection = SECTION_MAP[heading]
                i += 1
                continue

            # Is this a sub-component header (Sauce:, Dough:, etc.)?
            if looks_like_subheader(heading):
                if current is None:
                    i += 1
                    continue
                current["body"] += f"\n\n### {heading}\n"
                i += 1
                continue

            # Parenthetical alternate name e.g. "(Kjotsupa)" or "aka Foo" — attach to previous recipe
            is_alt_name = (
                heading.startswith("(") and heading.endswith(")")
                or heading.lower().startswith("aka ")
            )
            if is_alt_name and current is not None and current["body"].strip() == "":
                current["alt_title"] = heading.strip("()").strip()
                # consume any blank lines + italic credit if present
                j = i + 1
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                if j < len(lines) and is_italic_credit(lines[j]) and not current["credit"]:
                    current["credit"] = strip_italic(lines[j])
                    i = j + 1
                else:
                    i += 1
                continue

            # Otherwise it's a recipe title — start a new recipe.
            flush()
            title = heading
            # Peek ahead for a credit line within the next 1-2 non-empty lines.
            credit = None
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            if j < len(lines) and is_italic_credit(lines[j]):
                credit = strip_italic(lines[j])
                next_idx = j + 1
            else:
                next_idx = i + 1
            current = {
                "id":         slugify(f"{section or 'misc'}-{title}")[:80],
                "title":      title,
                "alt_title":  None,
                "section":    section or "Uncategorized",
                "subsection": subsection,
                "credit":     credit,
                "body":       "",
            }
            i = next_idx
            continue

        # Plain content line — append to current recipe (if any)
        if current is not None:
            current["body"] += line + "\n"
        i += 1

    flush()
    return recipes


def main():
    raw = RAW.read_text(encoding="utf-8")
    recipes = parse(raw)

    # Sort recipes within their sections, preserving the source order.
    # Write JSON — single source of truth lives in docs/ (served by the web app
    # AND read by build_docx.js). No duplicate copy at the repo root.
    out_json = HERE / "docs" / "recipes.json"
    out_json.parent.mkdir(exist_ok=True)
    out_json.write_text(json.dumps(recipes, indent=2, ensure_ascii=False), encoding="utf-8")

    # Write human-readable inventory.
    out_md = HERE / "recipes_inventory.md"
    by_section = {}
    for r in recipes:
        key = (r["section"], r["subsection"])
        by_section.setdefault(key, []).append(r)

    lines = ["# Swensen Family Cookbook — Recipe Inventory\n",
             f"**Total recipes parsed:** {len(recipes)}\n"]
    for (sec, sub), items in by_section.items():
        header = sec if not sub else f"{sec} — {sub}"
        lines.append(f"\n## {header}  ({len(items)} recipes)\n")
        for r in items:
            credit = f" — *{r['credit']}*" if r['credit'] else ""
            tags = ", ".join(r['tags']) if r['tags'] else ""
            lines.append(f"- **{r['title']}**{credit}  `[{tags}]`")
    out_md.write_text("\n".join(lines), encoding="utf-8")

    # Summary
    print(f"Parsed {len(recipes)} recipes.")
    counts = {}
    for r in recipes:
        key = (r["section"], r["subsection"])
        counts[key] = counts.get(key, 0) + 1
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
