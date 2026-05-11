#!/usr/bin/env python3
"""
One-shot cleanup of pandoc escape artifacts left over in titles and bodies.

Pandoc, when extracting from the original .docx, escaped a number of characters
with backslashes (\*, \', \", \#) so they wouldn't be re-interpreted as markdown
syntax.  Those escapes leaked into the recipe data and now show up literally
in the web app (e.g. "Chicken Alfredo\*\*").

This script does a single safe pass:
  - In titles: strip any trailing backslash-escape sequences, then unescape any
    remaining \' and \"  so the title reads naturally.
  - In bodies: unescape \', \", \#, and \* so the prose reads cleanly while
    keeping the asterisks themselves (they often mark notes or substitutions).
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
JSON_PATH = HERE / "docs" / "recipes.json"


def clean_title(t):
    if not t:
        return t
    # Strip trailing escape junk: \*\*, \*, etc., and any whitespace before them
    t = re.sub(r"\s*\\[\*\\]+\s*$", "", t)
    # Unescape \' → ', \" → "
    t = t.replace(r"\'", "'").replace(r'\"', '"').replace(r"\#", "#")
    return t.strip()


def clean_body(b):
    if not b:
        return b
    # Unescape common backslash escapes pandoc left behind.
    # We KEEP the asterisks themselves — they often mark notes/substitutions.
    return (
        b.replace(r"\'", "'")
         .replace(r'\"', '"')
         .replace(r"\#", "#")
         .replace(r"\*", "*")
    )


def main():
    data = json.loads(JSON_PATH.read_text())
    title_changes = 0
    body_changes = 0

    for r in data:
        new_title = clean_title(r["title"])
        if new_title != r["title"]:
            print(f"  TITLE: {r['title']!r}  ->  {new_title!r}")
            r["title"] = new_title
            title_changes += 1

        if r.get("alt_title"):
            new_alt = clean_title(r["alt_title"])
            if new_alt != r["alt_title"]:
                print(f"  ALT  : {r['alt_title']!r}  ->  {new_alt!r}")
                r["alt_title"] = new_alt
                title_changes += 1

        new_body = clean_body(r["body"])
        if new_body != r["body"]:
            r["body"] = new_body
            body_changes += 1

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"\nFixed {title_changes} title(s) and {body_changes} body/bodies.")


if __name__ == "__main__":
    main()
