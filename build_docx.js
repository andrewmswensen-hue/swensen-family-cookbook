// Generate the formatted Swensen Family Cookbook DOCX from recipes.json.
//
// Run:  node build_docx.js
// Output: Swensen_Family_Cookbook.docx
//
// Design:
//   - Warm "Mom Kitchen" palette: terracotta / gold / sage / cream
//   - Three sections: cover (1-column), TOC (2-column), recipes (1-column)
//   - TOC entries are clickable internal hyperlinks to bookmarked headings
//   - Bigger fonts (base 11pt) and more generous spacing
//   - keepNext + keepLines on recipe paragraphs so recipes rarely split

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel,
  PageBreak, PageNumber, BorderStyle,
  ExternalHyperlink, InternalHyperlink, Bookmark,
  SectionType,
} = require("docx");

const recipes = JSON.parse(fs.readFileSync(path.join(__dirname, "docs", "recipes.json"), "utf8"));

// Cross-listings are duplicates of Sous Vide recipes that live in their natural
// section for discovery (e.g. Sous Vide Tri-Tip also appears under Beef).
// They don't contribute to the global recipe count.
const isCounted = (r) => !r._crosslisting;
const countedRecipes = recipes.filter(isCounted);

// ── Palette (warm "Mom Kitchen") ────────────────────────────────────────────
const COLORS = {
  primary:    "A04A3B",
  accent:     "C89E5A",
  cream:      "FBF6EE",
  sage:       "7E8C6B",
  text:       "3C2E26",
  textLight:  "6B5A4F",
};

// All sizes are in half-points (docx convention: 22 = 11pt).
const SIZE = {
  coverTitle:   108,   // 54pt
  coverTagline:  36,   // 18pt
  coverMeta:     24,   // 12pt
  h1:            64,   // 32pt — section heading
  h2:            40,   // 20pt — subsection heading
  h3:            34,   // 17pt — recipe title
  altTitle:      24,   // 12pt
  credit:        22,   // 11pt
  body:          22,   // 11pt — base recipe text
  subheader:     24,   // 12pt — "Sauce:", "Dough:", etc.
  tocTitle:      48,   // 24pt
  tocSection:    28,   // 14pt — section labels in TOC
  tocSub:        24,   // 12pt — subsection labels in TOC
  tocRecipe:     22,   // 11pt — recipe entries
  tocCredit:     18,   // 9pt
  header:        18,   // running header
  footer:        20,   // page numbers
};

// ── Recipe order (by section/subsection) ────────────────────────────────────
const SECTION_ORDER = [
  ["Main Dishes", "Beef"],
  ["Main Dishes", "Chicken & Turkey"],
  ["Main Dishes", "Pork & Sausage"],
  ["Main Dishes", "Seafood"],
  ["Appetizers", "Dips & Spreads"],
  ["Appetizers", "Salsas"],
  ["Appetizers", "Wings"],
  ["Appetizers", "Other Appetizers"],
  ["Salads", null],
  ["Vegetables & Sides", "Potatoes"],
  ["Vegetables & Sides", "Vegetables"],
  ["Vegetables & Sides", "Other Sides"],
  ["Soups", null],
  ["Rice, Beans & Pasta", "Rice"],
  ["Rice, Beans & Pasta", "Beans"],
  ["Rice, Beans & Pasta", "Pasta"],
  ["Sandwiches", null],
  ["Breads", "Loaf & Quick Breads"],
  ["Breads", "Cinnamon Rolls & Crescents"],
  ["Breads", "Muffins & Scones"],
  ["Breads", "Biscuits & Savory"],
  ["Breads", "Jams"],
  ["Breakfast", null],
  ["Desserts", "Cookies"],
  ["Desserts", "Brownies & Bars"],
  ["Desserts", "Cakes"],
  ["Desserts", "Pies"],
  ["Desserts", "Other Desserts"],
  ["Desserts", "Frostings & Icings"],
  ["Desserts", "Candy"],
  ["Beverages", null],
  ["Kid's Stuff", null],
  ["Sous Vide", "How to Sous Vide"],
  ["Sous Vide", "Meat Temperature Guide"],
  ["Sous Vide", "Beef"],
  ["Sous Vide", "Pork"],
  ["Sous Vide", "Chicken"],
  ["Sous Vide", "Veggies"],
];

function bucketRecipes() {
  const buckets = new Map();
  for (const [sec, sub] of SECTION_ORDER) {
    buckets.set(`${sec}::${sub || ""}`, []);
  }
  for (const r of recipes) {
    const key = `${r.section}::${r.subsection || ""}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  return buckets;
}

// ── Bookmark naming ────────────────────────────────────────────────────────
// Bookmarks must be valid Word names: alphanumeric + underscore, no spaces.
function bmSection(sectionName)            { return `sec_${slug(sectionName)}`; }
function bmSubsection(section, sub)        { return `sub_${slug(section)}__${slug(sub)}`; }
function bmRecipe(id)                      { return `rec_${slug(id)}`; }
function slug(s)                           { return String(s).toLowerCase().replace(/[^\w]+/g, "_").replace(/^_|_$/g, ""); }

// Track which top-level sections have already had a heading emitted (so we
// don't repeat "Main Dishes" or "Desserts" for each subsection).
const openedSectionBookmarks = new Set();

// ── Body line classification ────────────────────────────────────────────────
function classifyBodyLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith("### ")) {
    return { type: "subheader", text: line.slice(4).replace(/:$/, "").trim() };
  }
  const ingredientHints = /^(\d+|\½|\¼|\¾|\⅓|\⅔|\⅛|\⅜|\⅝|\⅞)/;
  const looksMeasured = line.length < 100 && ingredientHints.test(line);
  const looksNamed =
    line.length < 60
    && /^(salt|pepper|oil|flour|sugar|water|butter|garlic|onion|milk|eggs?|vanilla|cheese|chicken|beef|pork|fish|shrimp|seasoning|marinade|rub|spice(s)?|dressing|sauce|broth|stock|vinegar|wine|lemon|lime|herbs?|tomato|potato|onion|carrot|beet|asparagus|mushroom|bacon|ham|sausage|cream|yeast)\b/i.test(line)
    && !/\.\s*$/.test(line);
  if (looksMeasured || looksNamed) return { type: "ingredient", text: line };
  return { type: "text", text: line };
}

function parseBody(bodyMd) {
  return bodyMd.split("\n").map(classifyBodyLine).filter(Boolean);
}

// ── Paragraph builders ──────────────────────────────────────────────────────
function sectionHeading(text) {
  // The Bookmark wraps the text so internal hyperlinks can target it.
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    children: [
      new Bookmark({
        id: bmSection(text),
        children: [new TextRun({ text, bold: true, color: COLORS.primary, size: SIZE.h1, font: "Georgia" })],
      }),
    ],
    spacing: { before: 0, after: 360 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: COLORS.accent, space: 12 } },
  });
}

function subsectionHeading(parentSection, text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    children: [
      new Bookmark({
        id: bmSubsection(parentSection, text),
        children: [new TextRun({ text, italics: true, color: COLORS.sage, size: SIZE.h2, font: "Georgia" })],
      }),
    ],
    spacing: { before: 360, after: 280 },
  });
}

// Build the run array for a recipe title.  When the title starts with
// "SOUS VIDE - " (the cross-listing convention), the "SOUS VIDE" prefix is
// rendered in a smaller italic sage accent so the actual recipe name reads
// naturally in title case — matching the web app's styling.
function titleRuns(title) {
  const m = title.match(/^(SOUS VIDE)\s*-\s*(.+)$/);
  if (m) {
    return [
      new TextRun({ text: m[1], italics: true, bold: false, color: COLORS.sage, size: Math.round(SIZE.h3 * 0.72), font: "Georgia" }),
      new TextRun({ text: " — ", color: COLORS.accent, size: SIZE.h3, font: "Georgia" }),
      new TextRun({ text: m[2], bold: true, color: COLORS.accent, size: SIZE.h3, font: "Georgia" }),
    ];
  }
  return [new TextRun({ text: title, bold: true, color: COLORS.accent, size: SIZE.h3, font: "Georgia" })];
}

function recipeTitle(title, recipeId) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true, keepLines: true,
    spacing: { before: 360, after: 100 },
    children: [
      new Bookmark({
        id: bmRecipe(recipeId),
        children: titleRuns(title),
      }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.cream, space: 4 } },
  });
}

function altTitleLine(alt) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: `(${alt})`, italics: true, color: COLORS.textLight, size: SIZE.altTitle, font: "Georgia" })],
  });
}

function creditLine(credit) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 0, after: 140 },
    children: [new TextRun({ text: `— ${credit}`, italics: true, color: COLORS.sage, size: SIZE.credit, font: "Georgia" })],
  });
}

function subHeaderLine(text) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, color: COLORS.primary, size: SIZE.subheader, font: "Georgia" })],
  });
}

function slugForBookmark(s) {
  return String(s).toLowerCase().replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
}

// Convert "plain text with [link text](url) inline links" into an array of
// TextRun + ExternalHyperlink/InternalHyperlink children.  Recognizes both
// external URLs (`https://...`) and internal SPA routes (`#/recipe/foo` or
// `#/recipe/foo/anchor`).  For internal recipe links, the URL maps to the
// recipe's bookmark in the printable cookbook (the anchor segment is dropped
// for print since we don't bookmark every subheader).
function inlineRuns(rawText, baseStyle) {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]+)\)/g;
  const runs = [];
  let pos = 0;
  let m;
  while ((m = linkRe.exec(rawText)) !== null) {
    if (m.index > pos) {
      runs.push(new TextRun({ ...baseStyle, text: rawText.slice(pos, m.index) }));
    }
    const linkText = m[1];
    const url = m[2];
    if (/^https?:/.test(url)) {
      runs.push(new ExternalHyperlink({
        link: url,
        children: [new TextRun({
          ...baseStyle, text: linkText,
          style: "Hyperlink", color: COLORS.primary, underline: {},
        })],
      }));
    } else {
      // Internal SPA route — translate `#/recipe/foo[/anchor]` into a Word
      // InternalHyperlink targeting the recipe's bookmark.
      const intMatch = url.match(/^#\/recipe\/([^/]+)(?:\/[^/]+)?$/);
      if (intMatch) {
        const recipeId = decodeURIComponent(intMatch[1]);
        runs.push(new InternalHyperlink({
          anchor: bmRecipe(recipeId),
          children: [new TextRun({
            ...baseStyle, text: linkText,
            style: "Hyperlink", color: COLORS.primary, underline: {},
          })],
        }));
      } else {
        // Unknown internal route — render the link text plainly.
        runs.push(new TextRun({ ...baseStyle, text: linkText }));
      }
    }
    pos = m.index + m[0].length;
  }
  if (pos < rawText.length) {
    runs.push(new TextRun({ ...baseStyle, text: rawText.slice(pos) }));
  }
  return runs;
}

function ingredientLine(text) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    indent: { left: 280, hanging: 280 },
    spacing: { before: 0, after: 40, line: 280 },
    children: [
      new TextRun({ text: "• ", color: COLORS.accent, bold: true, size: SIZE.body }),
      ...inlineRuns(text, { color: COLORS.text, size: SIZE.body }),
    ],
  });
}

function textLine(text, isLast) {
  return new Paragraph({
    keepNext: !isLast,
    keepLines: true,
    spacing: { before: 80, after: 100, line: 300 },
    children: inlineRuns(text, { color: COLORS.text, size: SIZE.body }),
  });
}

function recipeParagraphs(recipe) {
  const out = [];
  out.push(recipeTitle(recipe.title, recipe.id));
  if (recipe.alt_title) out.push(altTitleLine(recipe.alt_title));
  if (recipe.credit)    out.push(creditLine(recipe.credit));

  const items = parseBody(recipe.body);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    if (item.type === "subheader")        out.push(subHeaderLine(item.text));
    else if (item.type === "ingredient")  out.push(ingredientLine(item.text));
    else                                  out.push(textLine(item.text, isLast));
  }
  return out;
}

// ── Cover page ──────────────────────────────────────────────────────────────
function coverParagraphs() {
  return [
    new Paragraph({ spacing: { before: 3600 }, children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 280 },
      children: [new TextRun({ text: "The Swensen", color: COLORS.primary, size: SIZE.coverTitle, font: "Georgia", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 360 },
      children: [new TextRun({ text: "Family Cookbook", color: COLORS.primary, size: SIZE.coverTitle, font: "Georgia", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 280 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLORS.accent, space: 12 } },
      children: [new TextRun({ text: "", size: 12 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 240 },
      children: [new TextRun({ text: "Recipes from family & friends", italics: true, color: COLORS.sage, size: SIZE.coverTagline, font: "Georgia" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 0 },
      children: [new TextRun({ text: `${countedRecipes.length} recipes`, color: COLORS.textLight, size: SIZE.coverMeta, font: "Georgia" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 0 },
      children: [new TextRun({ text: "2025 Edition", color: COLORS.textLight, size: SIZE.coverMeta, font: "Georgia", italics: true })],
    }),
  ];
}

// ── TOC (manually generated, with clickable internal links) ────────────────
// Returns two arrays: a "title" block (1-column) and an "entries" block
// (intended for the 2-column section).
function tocTitleParagraphs() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 260 },
      children: [new TextRun({ text: "Table of Contents", color: COLORS.primary, size: SIZE.tocTitle, font: "Georgia", bold: true })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLORS.accent, space: 10 } },
    }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun("")] }),
  ];
}

function tocEntriesParagraphs() {
  const buckets = bucketRecipes();
  const out = [];
  const openedSections = new Set();

  for (const [sec, sub] of SECTION_ORDER) {
    const key = `${sec}::${sub || ""}`;
    const items = buckets.get(key) || [];
    if (items.length === 0) continue;

    if (!openedSections.has(sec)) {
      out.push(new Paragraph({
        spacing: { before: 280, after: 80 },
        keepNext: true, keepLines: true,
        children: [
          new InternalHyperlink({
            anchor: bmSection(sec),
            children: [new TextRun({ text: sec, bold: true, color: COLORS.primary, size: SIZE.tocSection, font: "Georgia" })],
          }),
        ],
      }));
      openedSections.add(sec);
    }
    if (sub) {
      out.push(new Paragraph({
        spacing: { before: 140, after: 60 },
        indent: { left: 200 },
        keepNext: true, keepLines: true,
        children: [
          new InternalHyperlink({
            anchor: bmSubsection(sec, sub),
            children: [new TextRun({ text: sub, italics: true, color: COLORS.sage, size: SIZE.tocSub, font: "Georgia" })],
          }),
        ],
      }));
    }
    for (const r of items) {
      out.push(new Paragraph({
        spacing: { before: 0, after: 50, line: 280 },
        indent: { left: sub ? 400 : 200 },
        keepLines: true,
        children: [
          new TextRun({ text: "·  ", color: COLORS.accent, size: SIZE.tocRecipe }),
          new InternalHyperlink({
            anchor: bmRecipe(r.id),
            children: [new TextRun({ text: r.title, color: COLORS.text, size: SIZE.tocRecipe, font: "Georgia" })],
          }),
          r.credit
            ? new TextRun({ text: `  — ${r.credit}`, color: COLORS.textLight, italics: true, size: SIZE.tocCredit, font: "Georgia" })
            : new TextRun(""),
        ],
      }));
    }
  }
  return out;
}

// ── Recipe body paragraphs ──────────────────────────────────────────────────
function bodyContentParagraphs() {
  const buckets = bucketRecipes();
  const out = [];
  const opened = new Set();

  for (const [sec, sub] of SECTION_ORDER) {
    const key = `${sec}::${sub || ""}`;
    const items = buckets.get(key) || [];
    if (items.length === 0) continue;

    if (!opened.has(sec)) {
      out.push(sectionHeading(sec));
      opened.add(sec);
    }
    if (sub) out.push(subsectionHeading(sec, sub));

    for (const r of items) {
      out.push(...recipeParagraphs(r));
    }
  }
  return out;
}

// ── Styles (heading styles for any Word TOC compatibility) ─────────────────
const styles = {
  default: { document: { run: { font: "Georgia", size: SIZE.body, color: COLORS.text } } },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: SIZE.h1, bold: true, font: "Georgia", color: COLORS.primary },
      paragraph: { spacing: { before: 240, after: 360 }, outlineLevel: 0 },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: SIZE.h2, italics: true, font: "Georgia", color: COLORS.sage },
      paragraph: { spacing: { before: 280, after: 220 }, outlineLevel: 1 },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: SIZE.h3, bold: true, font: "Georgia", color: COLORS.accent },
      paragraph: { spacing: { before: 360, after: 100 }, outlineLevel: 2 },
    },
  ],
};

// ── Shared section properties ──────────────────────────────────────────────
const PAGE = {
  size: { width: 12240, height: 15840 },              // US Letter
  margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },  // 0.75"
};

function headerObj() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Swensen Family Cookbook", italics: true, color: COLORS.sage, size: SIZE.header, font: "Georgia" })],
    })],
  });
}
function footerObj() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "— ", color: COLORS.accent, size: SIZE.footer }),
        new TextRun({ children: [PageNumber.CURRENT], color: COLORS.text, size: SIZE.footer, font: "Georgia" }),
        new TextRun({ text: " —", color: COLORS.accent, size: SIZE.footer }),
      ],
    })],
  });
}

// ── Build the whole document ────────────────────────────────────────────────
function buildDocument() {
  const doc = new Document({
    creator: "Swensen Family Cookbook",
    title: "Swensen Family Cookbook",
    description: "Recipes from family and friends",
    styles,
    sections: [
      // ── Section 1: Cover page (single column) ───────────────────────────
      {
        properties: { page: PAGE },
        headers: { default: headerObj() },
        footers: { default: footerObj() },
        children: coverParagraphs(),
      },
      // ── Section 2: TOC (title in 1 column, entries in 2 columns) ───────
      {
        properties: {
          page: PAGE,
          type: SectionType.NEXT_PAGE,
        },
        headers: { default: headerObj() },
        footers: { default: footerObj() },
        children: tocTitleParagraphs(),
      },
      // ── Section 3: TOC entries proper, in 2 columns ─────────────────────
      {
        properties: {
          page: PAGE,
          type: SectionType.CONTINUOUS,
          column: { count: 2, space: 540, equalWidth: true, separate: false },
        },
        headers: { default: headerObj() },
        footers: { default: footerObj() },
        children: tocEntriesParagraphs(),
      },
      // ── Section 4: Recipe content (back to 1 column, new page) ─────────
      {
        properties: {
          page: PAGE,
          type: SectionType.NEXT_PAGE,
        },
        headers: { default: headerObj() },
        footers: { default: footerObj() },
        children: bodyContentParagraphs(),
      },
    ],
  });

  return doc;
}

(async () => {
  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);
  const downloadsDir = path.join(__dirname, "docs", "downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });
  const docxOut = path.join(downloadsDir, "Swensen_Family_Cookbook.docx");
  fs.writeFileSync(docxOut, buffer);
  console.log(`Wrote ${docxOut}  (${buffer.length.toLocaleString()} bytes, ${recipes.length} recipes)`);

  // docx-js has a bug where every <w:bookmarkStart> gets w:id="1".  Run the
  // post-processor to renumber them so internal hyperlinks resolve correctly.
  const { spawnSync } = require("child_process");
  const fixer = path.join(__dirname, "fix_bookmarks.py");
  const fixed = spawnSync("python3", [fixer, docxOut], { stdio: "inherit" });
  if (fixed.status !== 0) {
    console.error("fix_bookmarks.py failed");
    process.exit(fixed.status || 1);
  }

  // Also export a fresh PDF alongside the DOCX so both downloads stay in sync.
  console.log("Exporting PDF via LibreOffice...");
  const pdf = spawnSync("soffice", [
    "--headless", "--convert-to", "pdf",
    "--outdir", downloadsDir,
    docxOut,
  ], { stdio: "inherit" });
  if (pdf.status !== 0) {
    console.error("PDF export failed");
    process.exit(pdf.status || 1);
  }
})();
