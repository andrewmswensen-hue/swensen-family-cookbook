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
  { name: "Appetizers", icon: "🧀" },
  { name: "Beverages", icon: "🍋" },
  { name: "Breads", icon: "🥖" },
  { name: "Soups", icon: "🍲" },
  { name: "Salads", icon: "🥗" },
  { name: "Sandwiches", icon: "🥪" },
  { name: "Vegetables & Sides", icon: "🥦" },
  { name: "Rice, Beans & Pasta", icon: "🍚" },
  { name: "Main Dishes", icon: "🍽️" },
  { name: "Breakfast", icon: "🍳" },
  { name: "Desserts", icon: "🍰" },
  { name: "Kid's Stuff", icon: "🎨" },
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
  if (backNav && scrollPositions[newHash] !== undefined) {
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
fetch("recipes.json")
  .then(r => r.json())
  .then(data => {
    RECIPES = data;
    BY_ID = new Map(RECIPES.map(r => [r.id, r]));
    countEl.textContent = `${RECIPES.length} recipes`;
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
  if (parts[0] === "recipe" && parts[1]) return renderRecipe(parts[1]);
  if (parts[0] === "search" && parts[1]) return renderSearch(parts[1]);

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

function searchRecipes(q) {
  const needle = q.toLowerCase().trim();
  if (!needle) return [];
  return RECIPES.filter(r => {
    if (r.title.toLowerCase().includes(needle)) return true;
    if (r.credit && r.credit.toLowerCase().includes(needle)) return true;
    if (r.section.toLowerCase().includes(needle)) return true;
    if (r.subsection && r.subsection.toLowerCase().includes(needle)) return true;
    if (r.tags && r.tags.some(t => t.toLowerCase().includes(needle))) return true;
    if (r.body.toLowerCase().includes(needle)) return true;
    return false;
  });
}

// ── Body markdown → HTML ──────────────────────────────────────────────────
function classifyLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith("### ")) {
    return { type: "subheader", text: line.slice(4).replace(/:$/, "").trim() };
  }
  const measureRe = /^(\d+|\½|\¼|\¾|\⅓|\⅔|\⅛|\⅜|\⅝|\⅞)/;
  const namedRe = /^(salt|pepper|oil|flour|sugar|water|butter|garlic|onion|milk|eggs?|vanilla|cheese|chicken|beef|pork|fish|shrimp)\b/i;
  const isMeasured = line.length < 90 && measureRe.test(line);
  const isNamed = line.length < 60 && namedRe.test(line) && !/\.\s*$/.test(line);
  if (isMeasured || isNamed) return { type: "ingredient", text: line };
  return { type: "step", text: line };
}

function renderBody(bodyMd) {
  const lines = bodyMd.split("\n").map(classifyLine).filter(Boolean);
  return lines.map(item => {
    if (item.type === "subheader") return `<h3 class="subheader">${escapeHtml(item.text)}</h3>`;
    if (item.type === "ingredient") return `<div class="ingredient">${escapeHtml(item.text)}</div>`;
    return `<p class="step">${escapeHtml(item.text)}</p>`;
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
    const matches = searchRecipes(q);
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
    count: RECIPES.filter(r => r.section === meta.name).length,
  })).filter(s => s.count > 0);

  const cards = sections.map(s => `
    <a class="section-card" href="#/section/${encodeURIComponent(s.name)}">
      <div>
        <div class="icon">${s.icon}</div>
        <div class="name">${escapeHtml(s.name)}</div>
      </div>
      <div class="count">${s.count} ${s.count === 1 ? "recipe" : "recipes"}</div>
    </a>
  `).join("");

  app.innerHTML = `
    <section class="hero">
      <h1>What are we cooking?</h1>
      <p>${RECIPES.length} family recipes, one search away.</p>
      ${SEARCH_BAR_HTML()}
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
      const count = recipesInSection(sectionName, sub).length;
      const subIcon = SUBSECTION_META[sub] || icon;
      return `
        <a class="section-card" href="#/section/${encodeURIComponent(sectionName)}/${encodeURIComponent(sub)}">
          <div>
            <div class="icon">${subIcon}</div>
            <div class="name">${escapeHtml(sub)}</div>
          </div>
          <div class="count">${count} ${count === 1 ? "recipe" : "recipes"}</div>
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
  app.innerHTML = `
    ${back}
    ${subBreadcrumb}
    <header class="section-header">
      <h1>${showingSubsection ? (SUBSECTION_META[subsection] || icon) : icon} ${escapeHtml(subsection || sectionName)}</h1>
      <div class="subtitle">${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}</div>
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
  if (recipe.subsection) {
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
      <div class="recipe-body">${renderBody(recipe.body)}</div>
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

function renderNotFound(msg) {
  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <div class="empty-state">
      <h2>${escapeHtml(msg)}</h2>
      <p><a href="#/">Return home</a></p>
    </div>
  `;
}
