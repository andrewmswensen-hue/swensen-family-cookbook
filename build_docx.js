// Generate the formatted Swensen Family Cookbook DOCX from recipes.json.
//
// Run:  node build_docx.js
// Output: Swensen_Family_Cookbook.docx
//
// Design rules (see CLAUDE.md):
//   - Warm "Mom Kitchen" palette: terracotta / gold / sage / cream
//   - H1 = section, H2 = subsection, H3 = recipe title
//   - Every recipe paragraph carries keepNext + keepLines so Word will try to
//     keep an entire recipe on one page
//   - TOC at the front, generated from heading levels

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageOrientation, HeadingLevel, TableOfContents,
  PageBreak, PageNumber, BorderStyle, LevelFormat, TabStopType,
  TabStopPosition, ExternalHyperlink, InternalHyperlink, Bookmark,
} = require("docx");

const recipes = JSON.parse(fs.readFileSync(path.join(__dirname, "docs", "recipes.json"), "utf8"));

// ── Palette (warm "Mom Kitchen") ────────────────────────────────────────────
const COLORS = {
  primary:    "A04A3B",  // deep terracotta — H1 + dividers
  accent:     "C89E5A",  // warm gold — H2 + recipe titles
  cream:      "FBF6EE",  // background tint
  sage:       "7E8C6B",  // soft sage — credits + separators
  text:       "3C2E26",  // warm charcoal — body
  textLight:  "6B5A4F",
};

// ── Recipe order (by section/subsection) ────────────────────────────────────
const SECTION_ORDER = [
  ["Appetizers", null],
  ["Beverages", null],
  ["Breads", null],
  ["Soups", null],
  ["Salads", null],
  ["Sandwiches", null],
  ["Vegetables & Sides", null],
  ["Rice, Beans & Pasta", null],
  ["Main Dishes", "Beef"],
  ["Main Dishes", "Chicken & Turkey"],
  ["Main Dishes", "Pork & Sausage"],
  ["Main Dishes", "Seafood"],
  ["Breakfast", null],
  ["Desserts", "Cookies"],
  ["Desserts", "Brownies & Bars"],
  ["Desserts", "Cakes"],
  ["Desserts", "Pies"],
  ["Desserts", "Other Desserts"],
  ["Desserts", "Frostings & Icings"],
  ["Desserts", "Candy"],
  ["Kid's Stuff", null],
];

// Bucket recipes by [section, subsection]
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

// ── Body line classification ────────────────────────────────────────────────
// Returns { type: "subheader"|"ingredient"|"text", text }
function classifyBodyLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith("### ")) {
    return { type: "subheader", text: line.slice(4).replace(/:$/, "").trim() };
  }
  // Heuristic: ingredient lines are short, start with a measurement, OR
  // begin with a common ingredient name AND don't end in a period (which would
  // signal a complete sentence/instruction fragment, not an ingredient).
  const ingredientHints = /^(\d+|\½|\¼|\¾|\⅓|\⅔|\⅛|\⅜|\⅝|\⅞)/;
  const looksMeasured = line.length < 90 && ingredientHints.test(line);
  const looksNamed =
    line.length < 60
    && /^(salt|pepper|oil|flour|sugar|water|butter|garlic|onion|milk|eggs?|vanilla|cheese|chicken|beef|pork|fish|shrimp)\b/i.test(line)
    && !/\.\s*$/.test(line);
  if (looksMeasured || looksNamed) return { type: "ingredient", text: line };
  return { type: "text", text: line };
}

function parseBody(bodyMd) {
  const lines = bodyMd.split("\n");
  const out = [];
  for (const raw of lines) {
    const item = classifyBodyLine(raw);
    if (item) out.push(item);
  }
  return out;
}

// ── Paragraph builders ──────────────────────────────────────────────────────
function p(opts) {
  return new Paragraph(opts);
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: text, bold: true, color: COLORS.primary, size: 56, font: "Georgia" })],
    spacing: { before: 0, after: 240 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent, space: 8 },
    },
  });
}

function subsectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: text, italics: true, color: COLORS.sage, size: 32, font: "Georgia" })],
    spacing: { before: 240, after: 200 },
  });
}

function recipeTitle(title, _recipeId) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    keepLines: true,
    spacing: { before: 280, after: 60 },
    children: [new TextRun({ text: title, bold: true, color: COLORS.accent, size: 26, font: "Georgia" })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.cream, space: 2 },
    },
  });
}

function altTitleLine(alt) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: `(${alt})`, italics: true, color: COLORS.textLight, size: 20, font: "Georgia" })],
  });
}

function creditLine(credit) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: `— ${credit}`, italics: true, color: COLORS.sage, size: 18, font: "Georgia" })],
  });
}

function subHeaderLine(text) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 80, after: 40 },
    children: [new TextRun({ text: text, bold: true, color: COLORS.primary, size: 19, font: "Georgia" })],
  });
}

function ingredientLine(text) {
  return new Paragraph({
    keepNext: true, keepLines: true,
    indent: { left: 200, hanging: 200 },
    spacing: { before: 0, after: 20, line: 240 },
    children: [
      new TextRun({ text: "• ", color: COLORS.accent, bold: true, size: 18 }),
      new TextRun({ text: text, color: COLORS.text, size: 18 }),
    ],
  });
}

function textLine(text, isLast) {
  return new Paragraph({
    keepNext: !isLast,
    keepLines: true,
    spacing: { before: 40, after: 60, line: 260 },
    children: [new TextRun({ text: text, color: COLORS.text, size: 18 })],
  });
}

// Build paragraphs for a single recipe.
function recipeParagraphs(recipe) {
  const out = [];
  out.push(recipeTitle(recipe.title, recipe.id));
  if (recipe.alt_title) out.push(altTitleLine(recipe.alt_title));
  if (recipe.credit) out.push(creditLine(recipe.credit));

  const items = parseBody(recipe.body);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    if (item.type === "subheader") out.push(subHeaderLine(item.text));
    else if (item.type === "ingredient") out.push(ingredientLine(item.text));
    else out.push(textLine(item.text, isLast));
  }
  return out;
}

// ── Title page ──────────────────────────────────────────────────────────────
function titlePage() {
  return [
    new Paragraph({ spacing: { before: 3600, after: 0 }, children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: "The Swensen", color: COLORS.primary, size: 96, font: "Georgia", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 320 },
      children: [new TextRun({ text: "Family Cookbook", color: COLORS.primary, size: 96, font: "Georgia", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent, space: 12 } },
      children: [new TextRun({ text: "", size: 12 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "Recipes from family & friends", italics: true, color: COLORS.sage, size: 32, font: "Georgia" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 0 },
      children: [new TextRun({ text: `${recipes.length} recipes`, color: COLORS.textLight, size: 22, font: "Georgia" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 0 },
      children: [new TextRun({ text: "2025 Edition", color: COLORS.textLight, size: 22, font: "Georgia", italics: true })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── Table of Contents (manually generated, two columns) ────────────────────
function tocPage() {
  const buckets = bucketRecipes();
  const out = [];
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: "Table of Contents", color: COLORS.primary, size: 44, font: "Georgia", bold: true })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent, space: 8 } },
  }));
  out.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun("")] }));

  // Build the entries
  const openedSections = new Set();
  for (const [sec, sub] of SECTION_ORDER) {
    const key = `${sec}::${sub || ""}`;
    const items = buckets.get(key) || [];
    if (items.length === 0) continue;

    if (!openedSections.has(sec)) {
      out.push(new Paragraph({
        spacing: { before: 160, after: 40 },
        children: [new TextRun({ text: sec, bold: true, color: COLORS.primary, size: 22, font: "Georgia" })],
      }));
      openedSections.add(sec);
    }
    if (sub) {
      out.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        indent: { left: 180 },
        children: [new TextRun({ text: sub, italics: true, color: COLORS.sage, size: 18, font: "Georgia" })],
      }));
    }
    for (const r of items) {
      out.push(new Paragraph({
        spacing: { before: 0, after: 20 },
        indent: { left: sub ? 360 : 180 },
        children: [
          new TextRun({ text: "·  ", color: COLORS.accent, size: 16 }),
          new TextRun({ text: r.title, color: COLORS.text, size: 16, font: "Georgia" }),
          r.credit ? new TextRun({ text: `  — ${r.credit}`, color: COLORS.textLight, italics: true, size: 14, font: "Georgia" }) : new TextRun(""),
        ],
      }));
    }
  }

  out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

// ── Style definitions ───────────────────────────────────────────────────────
const styles = {
  default: { document: { run: { font: "Georgia", size: 20, color: COLORS.text } } },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 56, bold: true, font: "Georgia", color: COLORS.primary },
      paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 32, italics: true, font: "Georgia", color: COLORS.sage },
      paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 26, bold: true, font: "Georgia", color: COLORS.accent },
      paragraph: { spacing: { before: 240, after: 60 }, outlineLevel: 2 },
    },
  ],
};

// ── Build the whole document ────────────────────────────────────────────────
function buildDocument() {
  const buckets = bucketRecipes();
  const children = [];

  children.push(...titlePage());
  children.push(...tocPage());

  // Track which top-level sections we've already opened to avoid duplicates.
  const openedSections = new Set();

  for (const [sec, sub] of SECTION_ORDER) {
    const key = `${sec}::${sub || ""}`;
    const items = buckets.get(key) || [];
    if (items.length === 0) continue;

    if (!openedSections.has(sec)) {
      children.push(sectionHeading(sec));
      openedSections.add(sec);
    }
    if (sub) {
      children.push(subsectionHeading(sub));
    }

    for (const r of items) {
      children.push(...recipeParagraphs(r));
    }
  }

  const doc = new Document({
    creator: "Swensen Family Cookbook",
    title: "Swensen Family Cookbook",
    description: "Recipes from family and friends",
    styles,
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },           // US Letter
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },  // 0.75" margins
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Swensen Family Cookbook", italics: true, color: COLORS.sage, size: 16, font: "Georgia" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "— ", color: COLORS.accent, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: COLORS.text, size: 16, font: "Georgia" }),
              new TextRun({ text: " —", color: COLORS.accent, size: 16 }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return doc;
}

(async () => {
  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);
  const out = path.join(__dirname, "Swensen_Family_Cookbook.docx");
  fs.writeFileSync(out, buffer);
  console.log(`Wrote ${out}  (${buffer.length.toLocaleString()} bytes, ${recipes.length} recipes)`);
})();
