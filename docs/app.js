// Swensen Family Cookbook — single-page app
// Hash-based routes:
//   #/                    home (search + section grid)
//   #/section/:section     section page (recipes grouped by subsection)
//   #/section/:section/:subsection  drill into a specific subsection
//   #/recipe/:id           individual recipe
//   #/search/:query        search results
//   #/submit               submit-a-recipe form

const app = document.getElementById("app");
const countEl = document.getElementById("recipe-count");

let RECIPES = [];          // array
let BY_ID = new Map();     // id → recipe

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

// ── Boot ──────────────────────────────────────────────────────────────────
fetch("recipes.json")
  .then(r => r.json())
  .then(data => {
    RECIPES = data;
    BY_ID = new Map(RECIPES.map(r => [r.id, r]));
    countEl.textContent = `${RECIPES.length} recipes`;
    window.addEventListener("hashchange", route);
    route();
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
  if (parts[0] === "submit") return renderSubmit();

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

function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

function recipesInSection(section, subsection) {
  return RECIPES.filter(r =>
    r.section === section &&
    (subsection === undefined || (r.subsection || null) === (subsection || null))
  );
}

function uniqueSubsections(section) {
  const subs = new Set();
  for (const r of RECIPES) {
    if (r.section === section && r.subsection) subs.add(r.subsection);
  }
  return Array.from(subs);
}

// ── Body markdown → HTML ──────────────────────────────────────────────────
// The body uses a custom markdown:
//   "### Foo"            → subheader
//   short ingredient line → bulleted ingredient
//   longer prose         → instruction step
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
  const html = [];
  for (const item of lines) {
    if (item.type === "subheader") html.push(`<h3 class="subheader">${escapeHtml(item.text)}</h3>`);
    else if (item.type === "ingredient") html.push(`<div class="ingredient">${escapeHtml(item.text)}</div>`);
    else html.push(`<p class="step">${escapeHtml(item.text)}</p>`);
  }
  return html.join("\n");
}

// ── Views ─────────────────────────────────────────────────────────────────
function renderHome() {
  const sections = SECTION_META.map(meta => {
    const count = RECIPES.filter(r => r.section === meta.name).length;
    return { ...meta, count };
  }).filter(s => s.count > 0);

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
      <div class="search-bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input id="search-input" type="search" placeholder="Search recipes, ingredients, or tags…" autocomplete="off" autofocus />
      </div>
    </section>
    <div class="section-grid">${cards}</div>
  `;

  const input = document.getElementById("search-input");
  input.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    if (q.length >= 2) {
      // Live-search: update hash without full re-render until they press enter
      // For simplicity, jump to search route on every change >= 2 chars
      // (Cheap because RECIPES is in memory)
      location.hash = `#/search/${encodeURIComponent(q)}`;
    }
  });
}

function renderSection(sectionName, subsection) {
  const section = SECTION_META.find(s => s.name === sectionName);
  if (!section && !RECIPES.some(r => r.section === sectionName)) {
    return renderNotFound(`Section "${sectionName}" not found.`);
  }

  const subsections = uniqueSubsections(sectionName);
  const filtered = subsection
    ? recipesInSection(sectionName, subsection)
    : recipesInSection(sectionName);

  // Group display
  let groupedHtml;
  if (subsection || subsections.length === 0) {
    groupedHtml = renderRecipeList(filtered);
  } else {
    // Render each subsection in turn
    const groups = subsections.map(sub => ({ sub, items: recipesInSection(sectionName, sub) }));
    const ungrouped = RECIPES.filter(r => r.section === sectionName && !r.subsection);
    if (ungrouped.length) groups.unshift({ sub: null, items: ungrouped });
    groupedHtml = groups.filter(g => g.items.length > 0).map(g => `
      ${g.sub ? `<h2 class="subsection-header">${escapeHtml(g.sub)}</h2>` : ""}
      ${renderRecipeList(g.items)}
    `).join("");
  }

  const icon = section ? section.icon : "🍴";
  const back = `<a href="#/" class="btn btn-back">← Back to home</a>`;
  const subBreadcrumb = subsection
    ? `<div class="recipe-section-trail"><a href="#/section/${encodeURIComponent(sectionName)}">${escapeHtml(sectionName)}</a> · ${escapeHtml(subsection)}</div>`
    : "";

  app.innerHTML = `
    ${back}
    ${subBreadcrumb}
    <header class="section-header">
      <h1>${icon} ${escapeHtml(subsection || sectionName)}</h1>
      <div class="subtitle">${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"}</div>
    </header>
    ${groupedHtml}
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
  const q = query.toLowerCase().trim();
  const matches = RECIPES.filter(r => {
    if (r.title.toLowerCase().includes(q)) return true;
    if (r.credit && r.credit.toLowerCase().includes(q)) return true;
    if (r.section.toLowerCase().includes(q)) return true;
    if (r.subsection && r.subsection.toLowerCase().includes(q)) return true;
    if (r.tags && r.tags.some(t => t.toLowerCase().includes(q))) return true;
    if (r.body.toLowerCase().includes(q)) return true;
    return false;
  });

  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <header class="section-header">
      <h1>Search: "${escapeHtml(query)}"</h1>
      <div class="subtitle">${matches.length} ${matches.length === 1 ? "match" : "matches"}</div>
    </header>
    <div class="search-bar" style="margin: 1.2rem 0 1.8rem;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input id="search-input" type="search" value="${escapeAttr(query)}" autofocus />
    </div>
    ${renderRecipeList(matches)}
  `;
  const input = document.getElementById("search-input");
  input.setSelectionRange(input.value.length, input.value.length);
  input.addEventListener("input", (e) => {
    const v = e.target.value.trim();
    if (v.length >= 2) {
      history.replaceState(null, "", `#/search/${encodeURIComponent(v)}`);
      renderSearch(v);
    } else if (v.length === 0) {
      location.hash = "#/";
    }
  });
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

// ── Submit a recipe ───────────────────────────────────────────────────────
function renderSubmit() {
  const allSections = [...new Set(RECIPES.map(r => r.section))];
  const subsections = JSON.stringify(
    Object.fromEntries(allSections.map(s => [s, [...new Set(RECIPES.filter(r => r.section === s && r.subsection).map(r => r.subsection))]]))
  );

  app.innerHTML = `
    <a href="#/" class="btn btn-back">← Back to home</a>
    <header class="section-header">
      <h1>Submit a Recipe</h1>
      <div class="subtitle">Add a new family recipe to the cookbook</div>
    </header>
    <div class="note">
      Fill in the form below.  When you click <strong>Generate</strong>, you'll get a recipe JSON snippet
      that you (or Andrew) can paste into <code>recipes.json</code> and commit to GitHub to publish the new recipe.
      Use <strong>Open GitHub Issue</strong> to send it straight to the cookbook repository.
    </div>
    <form class="submit-form" id="submit-form">
      <label>Recipe title <input name="title" required placeholder="e.g. Grandma's Apple Pie" /></label>

      <div class="form-row">
        <div>
          <label>Section
            <select name="section" id="section-select" required>
              <option value="">— choose —</option>
              ${allSections.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div>
          <label>Subsection (optional)
            <select name="subsection" id="subsection-select">
              <option value="">—</option>
            </select>
          </label>
        </div>
      </div>

      <label>Credit / who contributed <input name="credit" placeholder="e.g. Mom K., Grandma Ida, Stephanie" /></label>

      <label>Ingredients — one per line
        <textarea name="ingredients" rows="8" placeholder="2 cups flour
1 cup sugar
1 tsp salt
…" required></textarea>
      </label>

      <label>Instructions — one paragraph per line / step
        <textarea name="instructions" rows="6" placeholder="Preheat the oven to 350°F.
Mix dry ingredients in a large bowl.
…" required></textarea>
      </label>

      <label>Tags (optional, comma-separated) <input name="tags" placeholder="e.g. dessert, baked, holiday" /></label>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Generate snippet</button>
        <button type="button" class="btn btn-ghost" id="copy-btn" disabled>Copy to clipboard</button>
        <button type="button" class="btn btn-ghost" id="gh-issue-btn" disabled>Open GitHub Issue</button>
      </div>
    </form>
    <pre class="submit-output" id="output" style="display:none"></pre>
  `;

  const subMap = JSON.parse(subsections);
  const sectionSel = document.getElementById("section-select");
  const subSel = document.getElementById("subsection-select");
  sectionSel.addEventListener("change", () => {
    const subs = subMap[sectionSel.value] || [];
    subSel.innerHTML = `<option value="">—</option>` + subs.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join("");
  });

  const form = document.getElementById("submit-form");
  const out = document.getElementById("output");
  const copyBtn = document.getElementById("copy-btn");
  const ghBtn = document.getElementById("gh-issue-btn");
  let lastSnippet = null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const ingredients = data.ingredients.split("\n").map(s => s.trim()).filter(Boolean);
    const instructions = data.instructions.split("\n").map(s => s.trim()).filter(Boolean);
    const body = ingredients.join("\n") + "\n\n" + instructions.join("\n");
    const tags = data.tags
      ? data.tags.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];
    const id = slugify(`${data.section || "misc"}-${data.title}`).slice(0, 80);
    const recipe = {
      id,
      title: data.title.trim(),
      alt_title: null,
      section: data.section,
      subsection: data.subsection || null,
      credit: data.credit ? data.credit.trim() : null,
      body,
      tags,
    };
    lastSnippet = JSON.stringify(recipe, null, 2);
    out.textContent = lastSnippet;
    out.style.display = "block";
    copyBtn.disabled = false;
    ghBtn.disabled = false;
  });

  copyBtn.addEventListener("click", async () => {
    if (!lastSnippet) return;
    await navigator.clipboard.writeText(lastSnippet);
    copyBtn.textContent = "Copied!";
    setTimeout(() => copyBtn.textContent = "Copy to clipboard", 1500);
  });

  ghBtn.addEventListener("click", () => {
    if (!lastSnippet) return;
    const title = encodeURIComponent(`New recipe: ${JSON.parse(lastSnippet).title}`);
    const bodyText = `Please add this recipe to \`recipes.json\`:\n\n\`\`\`json\n${lastSnippet}\n\`\`\``;
    const body = encodeURIComponent(bodyText);
    const repo = window.COOKBOOK_REPO || "andrewmswensen-hue/swensen-family-cookbook";
    window.open(`https://github.com/${repo}/issues/new?title=${title}&body=${body}`, "_blank");
  });
}
