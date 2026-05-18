// Swensen Family Cookbook — single-page app
// Hash-based routes:
//   #/                              home (search + section grid)
//   #/section/:section              section page — if it has subsections,
//                                   shows subsection cards; otherwise flat list
//   #/section/:section/:subsection  flat recipe list for that subsection
//   #/recipe/:id                    individual recipe
//   #/search/:query                 permalink to a search result

const app = document.getElementById("app");
const countEl = document.getElementById("recipe-count");

let RECIPES = [];
let BY_ID = new Map();

// Section ordering + emoji icons for the home grid
const SECTION_META = [
  { name: "Main Dishes", icon: "🍽️" },
  { name: "Appetizers", icon: "🧀" },
  { name: "Salads", icon: "🥗" },
  { name: "Vegetables & Sides", icon: "🥦" },
  { name: "Soups", icon: "🍲" },
  { name: "Rice, Beans & Pasta", icon: "🍚" },
  { name: "Sandwiches", icon: "🥪" },
  { name: "Breads", icon: "🥖" },
  { name: "Breakfast", icon: "🍳" },
  { name: "Desserts", icon: "🍰" },
  { name: "Beverages", icon: "🥤" },
  { name: "Kid's Stuff", icon: "🎨" },
  { name: "Sous Vide", icon: "🌡️" },
];

const SUBSECTION_META = {
  // Appetizers
  "Dips & Spreads": "🥣",
  "Salsas": "🌶️",
  "Wings": "🍗",
  "Other Appetizers": "🥨",
  // Breads
  "Loaf & Quick Breads": "🍞",
  "Cinnamon Rolls & Crescents": "🥐",
  "Muffins & Scones": "🧁",
  "Biscuits & Savory": "🥯",
  "Jams": "🍓",
  // Vegetables & Sides
  "Potatoes": "🥔",
  "Vegetables": "🥦",
  "Other Sides": "🌽",
  // Rice, Beans & Pasta
  "Rice": "🍚",
  "Beans": "🫘",
  "Pasta": "🍝",
  // Main Dishes
  "Beef": "🥩",
  "Chicken & Turkey": "🍗",
  "Pork & Sausage": "🥓",
  "Seafood": "🐟",
  // Sous Vide
  "How to Sous Vide": "📖",
  "Meat Temperature Guide": "🌡️",
  "Pork": "🥓",
  "Chicken": "🍗",
  "Veggies": "🥦",
  // Desserts
  "Cookies": "🍪",
  "Brownies & Bars": "🟫",
  "Cakes": "🎂",
  "Pies": "🥧",
  "Other Desserts": "🍮",
  "Frostings & Icings": "🍦",
  "Candy": "🍬",
};

// ── Scroll-position memory ────────────────────────────────────────────────
const scrollPositions = {};
let lastHash = location.hash || "#/";
let backNav = false;

window.addEventListener("popstate", () => { backNav = true; });
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function saveScroll() {
  scrollPositions[lastHash] = window.scrollY || document.documentElement.scrollTop;
}
function applyScroll(newHash) {
  // Anchor URLs always win — if the hash points at a recipe-section anchor
  // like `#/recipe/foo/basic-workflow`, scroll the matching <h3 id> into
  // view after layout settles, regardless of forward or back navigation.
  const anchorMatch = newHash.match(/^#\/recipe\/[^/]+\/(.+)$/);
  if (anchorMatch) {
    requestAnimationFrame(() => {
      const el = document.getElementById(decodeURIComponent(anchorMatch[1]));
      if (el) el.scrollIntoView({ block: "start" });
      else window.scrollTo(0, 0);
    });
  } else if (backNav && scrollPositions[newHash] !== undefined) {
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions[newHash]));
  } else {
    window.scrollTo(0, 0);
  }
  backNav = false;
  lastHash = newHash;
}
function routeWithScroll() {
  saveScroll();
  route();
  applyScroll(location.hash || "#/");
}

// ── Boot ──────────────────────────────────────────────────────────────────
// `cache: "no-cache"` forces the browser to revalidate with the server on
// every load (using ETag), so a freshly-edited recipes.json on GitHub Pages
// shows up immediately instead of being stuck behind the 10-minute CDN cache.
// If the file hasn't changed, the server returns 304 Not Modified and we
// keep the local copy — no extra bandwidth cost.
fetch("recipes.json", { cache: "no-cache" })
  .then(r => r.json())
  .then(data => {
    RECIPES = data;
    BY_ID = new Map(RECIPES.map(r => [r.id, r]));
    countEl.textContent = `${RECIPES.filter(isCounted).length} recipes`;
    window.addEventListener("hashchange", routeWithScroll);
    route();
    applyScroll(location.hash || "#/");
  })
  .catch(err => {
    app.innerHTML = `<div class="empty-state"><h2>Couldn't load recipes</h2><p>${err.message}</p></div>`;
  });

// ── Router ────────────────────────────────────────────────────────────────
function route() {
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/").map(decodeURIComponent);

  if (!parts[0]) return renderHome();
  if (parts[0] === "section") {
    if (parts.length === 2) return renderSection(parts[1]);
    if (parts.length === 3) return renderSection(parts[1], parts[2]);
  }
  if (parts[0] === "recipe" && parts[1]) return renderRecipe(parts[1]);   // anchor (parts[2]) handled by applyScroll
  if (parts[0] === "search" && parts[1]) return renderSearch(parts[1]);
  if (parts[0] === "downloads") return renderDownloads();

  return renderHome();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(str) { return escapeHtml(str); }

// A "real" recipe is one that contributes to the global recipe count.
// Cross-listings (sous vide entries duplicated into Main Dishes / Veggies for
// discovery) carry _crosslisting: true and are skipped when counting.
function isCounted(r) { return !r._crosslisting; }

function recipesInSection(section, subsection) {
  return RECIPES.filter(r =>
    r.section === section &&
    (subsection === undefined || (r.subsection || null) === (subsection || null))
  );
}

function uniqueSubsections(section) {
  // Return in source order so the cards mirror the cookbook's natural progression.
  const subs = [];
  const seen = new Set();
  for (const r of RECIPES) {
    if (r.section === section && r.subsection && !seen.has(r.subsection)) {
      subs.push(r.subsection);
      seen.add(r.subsection);
    }
  }
  return subs;
}

// Search with relevance ranking.  A recipe scores points for each field it
// matches; we filter out zero-score recipes and return them sorted by score
// (highest first).  The hierarchy roughly says:
//   1. exact title match
//   2. title starts with query
//   3. word-boundary match in title
//   4. substring in title
//   5. tag match
//   6. credit match
//   7. section / subsection match
//   8. body match (lowest weight)
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function scoreRecipe(r, q) {
  const ql = q.toLowerCase().trim();
  if (!ql) return 0;

  const title      = r.title.toLowerCase();
  const credit     = (r.credit     || "").toLowerCase();
  const section    =  r.section.toLowerCase();
  const subsection = (r.subsection || "").toLowerCase();
  const tags       = (r.tags       || []).map(t => t.toLowerCase());
  const body       =  r.body.toLowerCase();

  // word-boundary regex (only built once per call)
  const wb = new RegExp(`\\b${escapeRegex(ql)}\\b`);

  let score = 0;
  if (title === ql)                score += 1000;
  else if (title.startsWith(ql))   score += 500;
  else if (wb.test(title))         score += 300;
  else if (title.includes(ql))     score += 200;

  if (tags.includes(ql))                       score += 150;
  else if (tags.some(t => t.includes(ql)))     score += 80;

  if (credit === ql)         score += 80;
  else if (credit.includes(ql)) score += 40;

  if (section === ql || subsection === ql)               score += 60;
  else if (section.includes(ql) || subsection.includes(ql)) score += 30;

  if (body.includes(ql)) {
    // Body matches are the weakest signal.  Cap their contribution so a
    // recipe with the query buried in its instructions can never outrank
    // a recipe whose title matches.
    const occurrences = body.split(ql).length - 1;
    score += Math.min(25, 5 + occurrences * 2);
  }

  return score;
}

function searchRecipes(q) {
  const needle = q.toLowerCase().trim();
  if (!needle) return [];
  return RECIPES
    .map(r => ({ recipe: r, score: scoreRecipe(r, needle) }))
    .filter(x => x.score > 0)
    .sort((a, b) => {
      // Higher score first; ties broken by title alphabetically for stable display.
      if (b.score !== a.score) return b.score - a.score;
      return a.recipe.title.localeCompare(b.recipe.title);
    })
    .map(x => x.recipe);
}

// ── Body markdown → HTML ──────────────────────────────────────────────────
function classifyLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith("### ")) {
    return { type: "subheader", text: line.slice(4).replace(/:$/, "").trim() };
  }
  const measureRe = /^(\d+|\½|\¼|\¾|\⅓|\⅔|\⅛|\⅜|\⅝|\⅞)/;
  const namedRe = /^(salt|pepper|oil|flour|sugar|water|butter|garlic|onion|milk|eggs?|vanilla|cheese|chicken|beef|pork|fish|shrimp|seasoning|marinade|rub|spice(s)?|dressing|sauce|broth|stock|vinegar|wine|lemon|lime|herbs?|tomato|potato|onion|carrot|beet|asparagus|mushroom|bacon|ham|sausage|cream|yeast)\b/i;
  const isMeasured = line.length < 90 && measureRe.test(line);
  const isNamed = line.length < 60 && namedRe.test(line) && !/\.\s*$/.test(line);
  if (isMeasured || isNamed) return { type: "ingredient", text: line };
  return { type: "step", text: line };
}

// Slugify a heading text into an HTML id (e.g. "Basic supplies" → "basic-supplies").
function anchorSlug(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
}

// Inline-markdown linkifier: converts `[text](https://…)` and `[text](#/…)` to
// anchors while escaping everything else.  External http(s) links open in a
// new tab; internal hash routes stay in the SPA.
function renderInline(rawText) {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]+)\)/g;
  const out = [];
  let pos = 0;
  let m;
  while ((m = linkRe.exec(rawText)) !== null) {
    if (m.index > pos) out.push(escapeHtml(rawText.slice(pos, m.index)));
    const isExternal = /^https?:/.test(m[2]);
    const target = isExternal ? ` target="_blank" rel="noopener noreferrer"` : "";
    out.push(`<a href="${escapeAttr(m[2])}"${target}>${escapeHtml(m[1])}</a>`);
    pos = m.index + m[0].length;
  }
  if (pos < rawText.length) out.push(escapeHtml(rawText.slice(pos)));
  return out.join("");
}

function renderBody(bodyMd, recipeId) {
  const lines = bodyMd.split("\n").map(classifyLine).filter(Boolean);
  return lines.map(item => {
    if (item.type === "subheader") {
      const slug = anchorSlug(item.text);
      const href = recipeId
        ? `#/recipe/${encodeURIComponent(recipeId)}/${slug}`
        : `#${slug}`;
      // The "#" anchor link sits to the right and surfaces a permalink to the
      // section.  Always visible but subtle; on hover/focus it darkens.
      return `<h3 class="subheader" id="${slug}">${escapeHtml(item.text)}<a class="anchor-link" href="${href}" aria-label="Link to ${escapeAttr(item.text)}">#</a></h3>`;
    }
    if (item.type === "ingredient") return `<div class="ingredient">${renderInline(item.text)}</div>`;
    return `<p class="step">${renderInline(item.text)}</p>`;
  }).join("\n");
}

// ── Search-bar wiring (shared between Home and Search views) ──────────────
//
// CRITICAL: the input element is created ONCE per view and never re-rendered
// while the user is typing.  Re-rendering destroys the focused element and
// closes the mobile keyboard — which was the bug.  Live results land in a
// separate <div id="inline-results"> that we update in place.
function wireSearchInput({ inputEl, resultsEl, gridEl, initialQuery }) {
  function update() {
    const q = inputEl.value.trim();
    if (!q) {
      if (resultsEl) resultsEl.style.display = "none";
      if (gridEl) gridEl.style.display = "grid";
      return;
    }
    // Filter duplicates: when the same recipe shows up via its canonical
    // entry AND its cross-listing, just show the canonical one.
    const matches = searchRecipes(q).filter(isCounted);
    if (gridEl) gridEl.style.display = "none";
    if (resultsEl) {
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `
        <header class="section-header">
          <h1>Search: "${escapeHtml(q)}"</h1>
          <div class="subtitle">${matches.length} ${matches.length === 1 ? "match" : "matches"}</div>
        </header>
        ${renderRecipeList(matches)}
      `;
    }
  }

  inputEl.addEventListener("input", update);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputEl.blur();   // dismiss the mobile keyboard on submit
      const q = inputEl.value.trim();
      if (q) {
        // Commit to a shareable URL.  We use replaceState to avoid spamming
        // history with one entry per keystroke.
        history.replaceState(null, "", `#/search/${encodeURIComponent(q)}`);
      }
    }
  });

  if (initialQuery) {
    inputEl.value = initialQuery;
    update();
  }
}

const SEARCH_BAR_HTML = (placeholder = "Search recipes, ingredients, or tags…") => `
  <div class="search-bar">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    <input id="search-input" type="search" placeholder="${escapeAttr(placeholder)}" autocomplete="off" enterkeyhint="search" />
  </div>
`;

// ── Views ─────────────────────────────────────────────────────────────────
function renderHome() {
  const sections = SECTION_META.map(meta => ({
    ...meta,
    count: RECIPES.filter(r => r.section === meta.name && isCounted(r)).length,
  })).filter(s => s.count > 0);

  const cards = sections.map(s => `
    <a class="section-card" href="#/section/${encodeURIComponent(s.name)}">
      <div>
        <div class="icon">${s.icon}</div>
        <div class="name">${escapeHtml(s.name)}</div>
      </div>
      <div class="count">${s.count} ${s.count === 1 ? "recipe" : "recipes"}</div>
    </a>
  `).join("") + `
    <a class="section-card section-card-extra" href="#/downloads">
      <div>
        <div class="icon">📦</div>
        <div class="name">Downloadable version</div>
      </div>
      <div class="count">PDF &middot; Word doc</div>
    </a>`;

  app.innerHTML = `
    <section class="hero">
      <h1>What are we cooking?</h1>
      <p>${RECIPES.filter(isCounted).length} family recipes, one search away.</p>
      ${SEARCH_BAR_HTML()}
      <a class="home-promo" href="#/section/${encodeURIComponent("Sous Vide")}">
        <span class="badge">New</span>
        <span>How to Sous Vide + recipes</span>
        <span class="arrow">→</span>
      </a>
    </section>
    <div id="inline-results" style="display:none"></div>
    <div id="section-grid" class="section-grid">${cards}</div>
  `;

  wireSearchInput({
    inputEl: document.getElementById("search-input"),
    resultsEl: document.getElementById("inline-results"),
    gridEl: document.getElementById("section-grid"),
  });
}

function renderSection(sectionName, subsection) {
  const section = SECTION_META.find(s => s.name === sectionName);
  if (!section && !RECIPES.some(r => r.section === sectionName)) {
    return renderNotFound(`Section "${sectionName}" not found.`);
  }

  const subsections = uniqueSubsections(sectionName);
  const showingSubsection = !!subsection;
  const recipes = showingSubsection
    ? recipesInSection(sectionName, subsection)
    : recipesInSection(sectionName);

  const icon = section ? section.icon : "🍴";
  const back = `<a href="#/" class="btn btn-back">← Back to home</a>`;
  const subBreadcrumb = showingSubsection
    ? `<div class="recipe-section-trail"><a href="#/section/${encodeURIComponent(sectionName)}">${escapeHtml(sectionName)}</a> · ${escapeHtml(subsection)}</div>`
    : "";

  // Case 1: subsection cards (intermediate level)
  if (!showingSubsection && subsections.length > 0) {
    const subsectionCards = subsections.map(sub => {
      const subRecipes = recipesInSection(sectionName, sub);
      const count = subRecipes.filter(isCounted).length;
      const subIcon = SUBSECTION_META[sub] || icon;
      // When a subsection has exactly one entry whose title matches the
      // subsection name (i.e. it's a single guide page, not a recipe
      // category that just happens to have one entry yet), link the card
      // straight to that entry — skip the intermediate one-item list.
      const isSingletonGuide = count === 1 && subRecipes[0].title === sub;
      const href = isSingletonGuide
        ? `#/recipe/${encodeURIComponent(subRecipes[0].id)}`
        : `#/section/${encodeURIComponent(sectionName)}/${encodeURIComponent(sub)}`;
      const countLabel = isSingletonGuide
        ? "Guide"
        : `${count} ${count === 1 ? "recipe" : "recipes"}`;
      return `
        <a class="section-card" href="${href}">
          <div>
            <div class="icon">${subIcon}</div>
            <div class="name">${escapeHtml(sub)}</div>
          </div>
          <div class="count">${countLabel}</div>
        </a>
      `;
    }).join("");

    app.innerHTML = `
      ${back}
      <header class="section-header">
        <h1>${icon} ${escapeHtml(sectionName)}</h1>
        <div class="subtitle">${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} in ${subsections.length} ${subsections.length === 1 ? "category" : "categories"}</div>
      </header>
      <div class="section-grid">${subsectionCards}</div>
    `;
    return;
  }

  // Case 2: flat list (no subsections, or a specific subsection is selected)
  const countedHere = recipes.filter(isCounted).length;
  app.innerHTML = `
    ${back}
    ${subBreadcrumb}
    <header class="section-header">
      <h1>${showingSubsection ? (SUBSECTION_META[subsection] || icon) : icon} ${escapeHtml(subsection || sectionName)}</h1>
      <div class="subtitle">${countedHere} ${countedHere === 1 ? "recipe" : "recipes"}</div>
    </header>
    ${renderRecipeList(recipes)}
  `;
}

function renderRecipeList(items) {
  if (items.length === 0) {
    return `<div class="empty-state"><h2>No recipes here yet</h2></div>`;
  }
  return `<ul class="recipe-list">${items.map(r => `
    <li>
      <a href="#/recipe/${encodeURIComponent(r.id)}">
        <span class="recipe-title">${escapeHtml(r.title)}</span>
        ${r.credit ? `<span class="recipe-credit">— ${escapeHtml(r.credit)}</span>` : ""}
        ${r.tags && r.tags.length ? `<div class="tags">${r.tags.slice(0, 5).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      </a>
    </li>
  `).join("")}</ul>`;
}

function renderRecipe(id) {
  const recipe = BY_ID.get(id);
  if (!recipe) return renderNotFound("Recipe not found.");

  const backLinks = [];
  backLinks.push(`<a href="#/" class="btn btn-back">← Home</a>`);
  backLinks.push(`<span class="sep">·</span>`);
  backLinks.push(`<a href="#/section/${encodeURIComponent(recipe.section)}" class="btn btn-back">← ${escapeHtml(recipe.section)}</a>`);
  // Skip the subsection crumb when it's the same as the recipe title — that
  // means it's a singleton guide page reached directly from the section grid.
  if (recipe.subsection && recipe.subsection !== recipe.title) {
    backLinks.push(`<span class="sep">·</span>`);
    backLinks.push(`<a href="#/section/${encodeURIComponent(recipe.section)}/${encodeURIComponent(recipe.subsection)}" class="btn btn-back">← ${escapeHtml(recipe.subsection)}</a>`);
  }

  app.innerHTML = `
    <article class="recipe">
      <div class="recipe-back-nav">${backLinks.join("")}</div>
      <div class="recipe-section-trail">
        ${escapeHtml(recipe.section)}${recipe.subsection ? ` · ${escapeHtml(recipe.subsection)}` : ""}
      </div>
      <header class="recipe-meta">
        <h1>${escapeHtml(recipe.title)}</h1>
        ${recipe.alt_title ? `<span class="alt-title">(${escapeHtml(recipe.alt_title)})</span>` : ""}
        ${recipe.credit ? `<span class="credit">— ${escapeHtml(recipe.credit)}</span>` : ""}
      </header>
      <div class="recipe-body">${renderBody(recipe.body, recipe.id)}</div>
      ${recipe.tags && recipe.tags.length ? `<div class="recipe-tags">${recipe.tags.map(t => `<a class="tag" href="#/search/${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join("")}</div>` : ""}
    </article>
  `;
}

function renderSearch(query) {
  // /search/<q> is a permalink view — but we still keep the input stable
  // so typing more characters doesn't kill focus on mobile.
  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <section class="hero" style="padding: 1rem 0 0.5rem;">
      ${SEARCH_BAR_HTML()}
    </section>
    <div id="inline-results"></div>
  `;
  wireSearchInput({
    inputEl: document.getElementById("search-input"),
    resultsEl: document.getElementById("inline-results"),
    gridEl: null,
    initialQuery: query,
  });
  document.getElementById("search-input").focus();
}

function renderDownloads() {
  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <header class="section-header">
      <h1>📦 Downloadable version</h1>
      <div class="subtitle">The full cookbook, ready to print or keep on your device</div>
    </header>
    <p style="max-width: 640px; line-height: 1.6;">
      All ${RECIPES.filter(isCounted).length} recipes — plus the How to Sous Vide guide — in a
      single document.  Download either format and you've got the entire
      cookbook offline.
    </p>
    <div class="download-grid">
      <a class="download-card" href="downloads/Swensen_Family_Cookbook.pdf" download>
        <div class="download-icon">📄</div>
        <div>
          <div class="download-title">PDF</div>
          <div class="download-meta">Best for reading on phones, tablets, and printing</div>
        </div>
        <div class="download-cta">Download →</div>
      </a>
      <a class="download-card" href="downloads/Swensen_Family_Cookbook.docx" download>
        <div class="download-icon">📝</div>
        <div>
          <div class="download-title">Word document</div>
          <div class="download-meta">Best if you want to edit, copy, or print with your own tweaks</div>
        </div>
        <div class="download-cta">Download →</div>
      </a>
    </div>
    <p style="margin-top: 2rem; color: var(--text-light); font-size: 0.9rem;">
      Files update whenever new recipes are added to the cookbook.  Bookmark
      this page and re-download any time you want the latest copy.
    </p>
  `;
}

function renderNotFound(msg) {
  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <div class="empty-state">
      <h2>${escapeHtml(msg)}</h2>
      <p><a href="#/">Return home</a></p>
    </div>
  `;
}
