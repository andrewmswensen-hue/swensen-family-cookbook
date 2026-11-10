/* Swensen Family Cookbook: Cook mode
 *
 * A focused, one-step-at-a-time cooking view with built-in timers.
 * app.js opens it for the route  #/cook/<recipe-id>  via CookMode.open().
 *
 * WHERE THE DATA COMES FROM
 *   - If a recipe has a `cook` block in recipes.json, that is used (explicit).
 *   - Otherwise everything is worked out from the recipe's `body` text (auto).
 *   - Explicit always wins, field by field: a step that leaves out `timer` gets
 *     one auto-detected from its text; a step with "timer": null gets none.
 *
 * TIMERS
 *   Every running timer stores the clock time it will END (endAt).  Time left
 *   is always "endAt minus now", so timers stay accurate if the phone locks or
 *   the tab sleeps.  The 1-second ticker only repaints and checks for finished
 *   timers; it never counts anything down.
 *
 * SAVED PROGRESS
 *   Stored on the device (localStorage) per recipe: current step, checked
 *   ingredients, batch size, and timers.  Cross-listed copies of a recipe
 *   share progress with the original.
 *
 * No libraries.  Works without any network calls once the page is loaded.
 */
(function () {
  "use strict";

  // ── Small helpers ────────────────────────────────────────────────────────
  const KEY_PREFIX = "swensen-cook:v1:";
  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Inline formatting for step text: [links](url) and **bold**.  Everything
  // else is escaped.
  function inline(raw) {
    const text = String(raw).replace(/\\([*'"#])/g, "$1");
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]+)\)/g;
    let out = "", pos = 0, m;
    while ((m = linkRe.exec(text)) !== null) {
      out += boldify(esc(text.slice(pos, m.index)));
      const ext = /^https?:/.test(m[2]);
      out += `<a href="${esc(m[2])}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(m[1])}</a>`;
      pos = m.index + m[0].length;
    }
    return out + boldify(esc(text.slice(pos)));
  }
  function boldify(html) {
    return html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\u27E6([^\u27E7]*)\u27E7/g, '<span class="cm-scaled">$1</span>');   // amounts changed by the batch size
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
  }
  function cap(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    keys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(KEY_PREFIX) === 0) out.push(k); } } catch (e) {} return out; },
  };

  // ── Numbers and amounts ──────────────────────────────────────────────────
  const FRAC = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
  const FC = "½¼¾⅓⅔⅛⅜⅝⅞";
  // One amount: "2½", "2 ½", "1 1/2", "1/3", "½", "1.5", "2"
  const NUM = `(?:\\d+(?:\\.\\d+)?\\s*[${FC}]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|[${FC}]|\\d+(?:\\.\\d+)?)`;
  const QTY_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?(?=\\s|$|\\()`);

  function parseNum(s) {
    s = String(s).trim();
    let m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*([${FC}])$`));
    if (m) return +m[1] + FRAC[m[2]];
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if (FRAC[s] !== undefined) return FRAC[s];
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Friendly kitchen fractions: 1.5 → "1½", 0.333 → "⅓", 13.4 → "13½"
  function fmtNum(n) {
    if (n >= 10) { const r = Math.round(n * 2) / 2; return r % 1 ? `${Math.floor(r)}½` : String(r); }
    const opts = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""]];
    let whole = Math.floor(n + 1e-9);
    const frac = n - whole;
    let best = opts[0];
    for (const o of opts) if (Math.abs(frac - o[0]) < Math.abs(frac - best[0])) best = o;
    if (best[0] === 1) whole += 1;
    const f = best[0] === 1 ? "" : best[1];
    if (!whole && !f) return n > 0 ? "⅛" : "0";
    return (whole ? String(whole) : "") + f;
  }

  // "2 cup" → "2 cups", "1 cups" → "1 cup" after scaling.
  const PLURAL_UNIT = /^(cup|pound|ounce|clove|stick|can|quart|pint|teaspoon|tablespoon|package|jar|slice|head|sprig|pinch)(e?s)?\b/i;
  function fixUnit(n, rest) {
    return String(rest).replace(PLURAL_UNIT, (all, base, pl) => {
      const plural = n > 1;
      if (plural && !pl) return base + (/(ch|sh)$/i.test(base) ? "es" : "s");
      if (!plural && pl) return base;
      return all;
    });
  }

  // Scale amounts written inside step text ("¾ tsp salt" → "1½ tsp salt").
  // Only numbers followed by a kitchen measure are touched, so oven
  // temperatures, times, pan sizes and "1-gallon bag" stay as written.
  const MEASURE = "(?:tsp|teaspoons?|Tbl|Tbsp|tbsp|tablespoons?|cups?|oz|ounces?|pounds?|lbs?|lb|cloves?|sticks?|cans?|pinch(?:es)?|quarts?|pints?)";
  const TEXT_AMT_RE = () => new RegExp(`(^|[^\\d/.\\w-])(${NUM})(?:(\\s*(?:-|–|to)\\s*)(${NUM}))?(\\s+${MEASURE})\\b`, "g");
  function scaleText(text, s) {
    if (s === 1) return text;
    return String(text).replace(TEXT_AMT_RE(), (all, pre, a, sep, b, unit) => {
      const lo = parseNum(a), hi = b ? parseNum(b) : null;
      if (lo === null) return all;
      const top = (hi !== null ? hi : lo) * s;
      return `${pre}\u27E6${fmtNum(lo * s)}${hi !== null ? ` to ${fmtNum(hi * s)}` : ""}${unit.replace(/\S+/, u => fixUnit(top, u))}\u27E7`;
    });
  }

  // ── Durations ───────────────────────────────────────────────────────────
  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, "forty-five": 45, forty: 40, sixty: 60, ninety: 90 };
  const DNUM = `(?:${NUM}|\\b(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty-five|forty|sixty|ninety)\\b)`;
  const UNIT = "(seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b";
  const DUR_RE = () => new RegExp(`(${DNUM})(?:\\s*(?:-|–|to|or)\\s*(${DNUM}))?\\s+${UNIT}`, "gi");
  const ATLEAST_RE = () => new RegExp(`at least\\s+(${DNUM})\\s+${UNIT}\\s*,?\\s*(?:or\\s+)?up to\\s+(${DNUM})\\s+${UNIT}`, "gi");
  const HAS_DUR = new RegExp(`${DNUM}(?:\\s*(?:-|–|to|or)\\s*${DNUM})?\\s+${UNIT}`, "i");

  function dnum(s) { const w = WORDNUM[String(s).toLowerCase()]; return w !== undefined ? w : parseNum(s); }
  function unitSec(u) { u = u.toLowerCase(); return u.charAt(0) === "h" ? 3600 : u.charAt(0) === "m" ? 60 : 1; }

  const CONTEXT_STOP = new Set("for about at to the a an until approximately another additional then and or more least up of in on over with".split(" "));

  // Find every duration in a step's text.  Returns [{min, max, note, at, end}]
  // (seconds; `at`/`end` are positions in the text, used for naming the timer).
  function detectTimers(text) {
    const found = [], taken = [];
    let m;
    const al = ATLEAST_RE();
    while ((m = al.exec(text))) {
      const a = dnum(m[1]) * unitSec(m[2]), b = dnum(m[3]) * unitSec(m[4]);
      if (a > 0) { found.push({ at: m.index, end: m.index + m[0].length, min: a, max: b > a ? b : null, note: null }); taken.push([m.index, m.index + m[0].length]); }
    }
    const dr = DUR_RE();
    while ((m = dr.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      // "a second baking sheet" is not a 1-second timer
      if (/^s/i.test(m[3]) && !/\d/.test(m[1])) continue;
      const mult = unitSec(m[3]);
      const lo = dnum(m[1]), hi = m[2] ? dnum(m[2]) : null;
      if (!lo || lo <= 0) continue;
      const after = text.slice(e, e + 12).toLowerCase();
      if (/^\s*(?:per|a|each|for each)\s+(?:pound|lb|inch)/.test(after)) continue;   // "25 minutes per pound" can't be a fixed timer
      const note = /^\s*each/.test(after) ? "each" : /^\s*per side/.test(after) ? "per side" : null;
      found.push({ at: s, end: e, min: lo * mult, max: hi && hi > lo ? hi * mult : null, note });
    }
    return found.sort((a, b) => a.at - b.at).slice(0, 3);
  }

  // Name a timer after the words that lead up to it in its own sentence:
  // "Knead for 5 to 7 minutes" → "Knead"; "Bake the loaves 35 minutes or
  // rolls 18 to 20 minutes" → "Bake the loaves" and "Bake rolls".
  const LABEL_TRAIL = /(?:\s|,|—|-|\b(?:for|about|approximately|at least|another|an additional|additional|until|to|or|and|the|a|an|then|cook time|time)\b)+$/i;
  function timerLabel(text, timers, i) {
    const t = timers[i];
    const sentStart = Math.max(text.lastIndexOf(". ", t.at), text.lastIndexOf("! ", t.at), text.lastIndexOf("? ", t.at)) + 1;
    const prev = i > 0 && timers[i - 1].end > sentStart ? timers[i - 1] : null;
    const seg = text.slice(prev ? prev.end : sentStart, t.at).replace(/\([^)]*\)/g, " ").replace(LABEL_TRAIL, "").trim();
    if (prev) {
      const clause = seg.split(/[,;]/).map(c => c.trim().replace(/^(?:and|then|or)\s+/i, "")).filter(Boolean).pop() || "";
      if (VERB_RE.test(clause)) return autoTitle(clause);
      const sentence = text.slice(sentStart).trim();
      const verb = VERB_RE.test(sentence) ? sentence.split(/\s+/)[0] : "";
      const words = seg.replace(/[^A-Za-z\s'-]/g, " ").split(/\s+/).filter(w => w && !CONTEXT_STOP.has(w.toLowerCase()) && w.toLowerCase() !== "each").slice(-2);
      const label = [verb, ...words].join(" ").trim();
      return label ? cap(label.toLowerCase()) : null;
    }
    const label = seg ? autoTitle(seg) : "";
    return label && label !== "Next step" && label.length > 2 ? label : null;
  }

  // Times under 2 hours read in minutes ("75 min"), like recipes write them.
  function fmtDurShort(sec) {
    sec = Math.round(sec);
    if (sec < 60) return `${sec} sec`;
    const h = Math.floor(sec / 3600), mn = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (sec < 7200) return s === 30 ? `${fmtNum(sec / 60)} min` : s ? `${Math.floor(sec / 60)} min ${s} sec` : `${Math.floor(sec / 60)} min`;
    return mn ? `${h} hr ${mn} min` : `${h} hr`;
  }
  function fmtDurLong(sec) {
    sec = Math.round(sec);
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    if (sec < 60) return plural(sec, "second");
    if (sec < 7200) {
      const whole = Math.floor(sec / 60), s = sec % 60;
      if (s === 30) return `${fmtNum(sec / 60)} minutes`;
      return s ? `${plural(whole, "minute")} ${plural(s, "second")}` : plural(whole, "minute");
    }
    const h = Math.floor(sec / 3600), mn = Math.round((sec % 3600) / 60);
    return mn ? `${plural(h, "hour")} ${plural(mn, "minute")}` : plural(h, "hour");
  }
  function fmtClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const pad = n => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function rangeLabel(t) {
    if (!t.max) return fmtDurShort(t.min);
    const a = t.min, b = t.max;
    if (b < 60) return `${a} to ${b} sec`;
    if (b < 7200 && a % 30 === 0 && b % 30 === 0) return `${fmtNum(a / 60)} to ${fmtNum(b / 60)} min`;
    if (a % 3600 === 0 && b % 3600 === 0) return `${a / 3600} to ${b / 3600} hr`;
    return `${fmtDurShort(a)} to ${fmtDurShort(b)}`;
  }

  // ── Reading the recipe text (auto mode) ─────────────────────────────────
  const VERB_RE = /^(preheat|heat|combine|mix|stir|add|bake|cook|place|pour|beat|cream|whisk|blend|melt|bring|boil|simmer|cover|cut|slice|chop|dice|season|sprinkle|spread|roll|fold|knead|let|allow|remove|transfer|serve|top|drain|rinse|toss|arrange|brush|grease|spray|line|put|set|using|use|fry|saute|sauté|sear|brown|grill|roast|broil|microwave|refrigerate|chill|freeze|cool|garnish|divide|shape|form|press|wrap|fill|layer|repeat|return|reduce|turn|flip|pat|rub|marinate|soak|mash|puree|purée|process|pulse|grate|peel|trim|scoop|drop|dip|coat|store|keep|prepare|make|in|on|when|once|after|while|meanwhile|if|then|start|adjust|lower|seal|gently|slowly|enjoy|pop|dump|squeeze|crush|warm|toast|shake|pound|halve|score|strain|scrape|sift|whip|wash|soften|tie|insert|lay|smash|continue|blanch|steam|stuff|spoon|ladle|bring)\b/i;
  const YIELD_RE = /^\(?\s*(makes|yields?|serves|servings)\b|^(prep|cook|total) time\b/i;
  const NOTE_HEAD_RE = /make ahead|variation|\bnotes?\b|\btips?\b|story|serving suggestion|substitut|where to learn|why this|storage|to store/i;

  function isIngredientLine(p) {
    if (p.length > 220) return false;
    if (/[.!?]\s+[A-Z(]/.test(p)) return false;                 // more than one sentence
    if (/\bdegrees\b|°/.test(p) && HAS_DUR.test(p)) return false; // "350 degrees for 40 minutes."
    if (QTY_RE.test(p)) return true;                              // starts with an amount
    if (p.length > 70) return false;
    if (VERB_RE.test(p) && (/[.!]$/.test(p) || p.length > 30)) return false;
    return true;                                                  // "Salt and pepper", "M&Ms"
  }

  // Split body into blocks (blank-line separated).  A multi-line block is a
  // list of ingredients only when every line looks like one; otherwise it's a
  // single paragraph whose lines were hard-wrapped when it came over from Word.
  function bodyBlocks(body) {
    const out = [];
    for (const raw of String(body || "").split(/\n\s*\n/)) {
      let lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
      while (lines.length && lines[0].indexOf("### ") === 0) { out.push({ kind: "head", text: lines.shift().slice(4).replace(/:$/, "").trim() }); }
      if (!lines.length) continue;
      if (lines.length > 1 && lines.every(isIngredientLine)) {
        const merged = [];
        for (const l of lines) {
          const prev = merged[merged.length - 1];
          if (prev && /^[a-z]/.test(l) && prev.length > 58 && !/[.,;:]$/.test(prev)) merged[merged.length - 1] = prev + " " + l;
          else merged.push(l);
        }
        merged.forEach(l => out.push({ kind: "line", text: l }));
      } else {
        out.push({ kind: "line", text: lines.join(" ").replace(/\s{2,}/g, " ") });
      }
    }
    return out;
  }

  const ABBR_WORD = /^\(?(?:tsp|tbsp|tbl|oz|lb|lbs|pkg|pkgs|approx|min|hr|hrs|reg|no|vs|etc|st|mrs|mr|ms|pt|qt|c|e\.g|i\.e|lg|sm|med|fl|sq|doz|temp|[a-z])\.$/i;
  function splitSentences(text) {
    const out = []; let start = 0; const re = /[.!?]+["')\]]*\s+/g; let m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      const next = text.charAt(end);
      const lastWord = (text.slice(start, m.index + 1).match(/(\S+)$/) || [""])[0];
      if (/[a-z]/.test(next)) continue;
      if (ABBR_WORD.test(lastWord)) continue;
      out.push(text.slice(start, end).trim()); start = end;
    }
    if (start < text.length) out.push(text.slice(start).trim());
    return out.filter(Boolean);
  }

  // Break a long paragraph into steps of 1 to 3 sentences.  A sentence with a
  // cooking time ends its step, so each timer lines up with the right step.
  function chunkParagraph(text) {
    const sentences = splitSentences(text);
    const chunks = []; let cur = [];
    const len = a => a.join(" ").length;
    for (const s of sentences) {
      cur.push(s);
      if (HAS_DUR.test(s) || cur.length >= 3 || len(cur) >= 260) { chunks.push(cur); cur = []; }
    }
    if (cur.length) {
      if (chunks.length && len(cur) < 45) chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(cur);
      else chunks.push(cur);
    }
    return chunks.map(c => c.join(" "));
  }

  const TITLE_PREP = new Set("in on into onto with for until over at to from of by about under before after while".split(" "));
  const TITLE_DUR_RE = () => new RegExp(`(?:\\s+(?:for|about|approximately|another|at least))?\\s*${DNUM}(?:\\s*(?:-|–|to|or)\\s*${DNUM})?\\s+${UNIT}(?:\\s+(?:each|per side|more|longer))?`, "gi");
  function autoTitle(text) {
    let t = String(text).replace(TITLE_DUR_RE(), " ").replace(/\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    let clauses = t.split(/[,;:.!?]/).map(c => c.trim()).filter(Boolean);
    if (clauses.length > 1 && /^(?:using|in|on|into|with|meanwhile|while|when|once|after|then|if|optionally|for best results)\b/i.test(clauses[0])) clauses = clauses.slice(1);
    const words = (clauses[0] || t).split(" ").filter(Boolean);
    let cut = words.length;
    if (words.length > 6) {
      cut = 6;
      for (let i = Math.min(7, words.length - 1); i >= 3; i--) {
        const w = words[i].toLowerCase();
        if (TITLE_PREP.has(w) || w === "and" || w === "or") { cut = i; break; }
      }
    }
    return cap(words.slice(0, cut).join(" ")) || "Next step";
  }

  // Words that describe prep or amounts, not what the ingredient is.
  const PREP_WORDS = new Set(("chopped minced diced sliced shredded grated crumbled softened melted fresh freshly large small medium finely thinly coarsely roughly peeled packed light dark ground unsalted salted extra-virgin extra virgin boneless skinless trimmed warm cold hot room temperature cup cups c tbl tbsp tablespoon tablespoons tsp teaspoon teaspoons oz ounce ounces lb lbs pound pounds pkg pkgs package packages can cans jar jars clove cloves head bunch sprig sprigs pinch dash stick sticks cube cubes quart quarts pint pints gallon slice slices piece pieces whole halved quartered cut into inch inches thick thin plus more optional divided reg regular lite fat free each box bag dry raw cooked uncooked frozen thawed canned drained rinsed sifted beaten well lightly heaping level scant generous gram grams kilogram kilograms ml liter liters taste to the a an of for").split(" "));

  const GENERIC_LAST = new Set("kernels sauce juice zest filets fillets leaves powder seeds chips crumbs broth stock paste extract flakes mix seasoning".split(" "));
  function ingredientKeys(text) {
    const core = String(text).toLowerCase().replace(/\([^)]*\)/g, " ").split(/[,;]/)[0];
    const keys = [];
    for (const part of core.split(/\s+(?:and|or|&)\s+/)) {
      const words = part.replace(/[^a-z&'\s-]/g, " ").split(/\s+/).filter(w => w && w.length > 2 && !PREP_WORDS.has(w));
      if (words.length) keys.push(words[words.length - 1]);
      if (words.length > 1 && GENERIC_LAST.has(words[words.length - 1])) keys.push(words[words.length - 2]);
    }
    return keys;
  }
  function keyRegex(k) {
    const e = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let pat;
    if (/ies$/.test(k)) pat = e.slice(0, -3) + "(?:y|ies)";
    else if (/oes$/.test(k)) pat = e.slice(0, -2) + "(?:es)?";
    else if (/[^s]s$/.test(k)) pat = e.slice(0, -1) + "s?";
    else pat = e + "(?:s|es)?";
    return new RegExp(`(^|[^a-z])${pat}(?![a-z])`, "i");
  }

  const COUNT_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function matchIngredients(text, ingredients) {
    const t = String(text).toLowerCase();
    let m = t.match(/\bfirst (two|three|four|five|six|seven|eight|nine|ten|\d+) ingredients\b/);
    if (m) return ingredients.slice(0, COUNT_WORDS[m[1]] || parseInt(m[1], 10)).map(i => i.id);
    if (/\ball (?:the )?(?:remaining |other )?ingredients\b|\beverything\b|^(?:combine|mix|whisk|stir|blend|put|place) (?:all|together)\b/.test(t)) {
      const ex = t.match(/\bexcept (?:for )?(?:the )?([a-z\s&'-]+?)(?=[,.;]| in | and |$)/);
      const exKeys = ex ? ex[1].split(/\s+/) : [];
      return ingredients.filter(i => !i.keys.some(k => exKeys.some(w => keyRegex(k).test(w)))).map(i => i.id);
    }
    return ingredients.filter(i => i.keys.some(k => keyRegex(k).test(t))).map(i => i.id);
  }

  // ── Build the cooking model for one recipe ──────────────────────────────
  // Returns { ingredients, steps, notes, servings, yieldText }
  function buildModel(recipe) {
    const blocks = bodyBlocks(recipe.body);
    const autoIngs = [], notes = [], paras = [];
    let group = null, inNote = false, ids = new Set();
    for (const b of blocks) {
      if (b.kind === "head") {
        inNote = NOTE_HEAD_RE.test(b.text);
        if (inNote) notes.push({ heading: b.text, lines: [] }); else group = b.text;
        continue;
      }
      let text = b.text;
      if (inNote) { notes[notes.length - 1].lines.push(text); continue; }
      if (/^[^.]{1,40}:$/.test(text)) { group = cap(text.replace(/:$/, "").replace(/^for the\s+/i, "")); continue; }
      const pre = text.match(/^for the ([\w\s'-]{1,30}):\s*/i);
      if (pre) { group = cap(pre[1]); text = text.slice(pre[0].length); }
      if (YIELD_RE.test(text) && text.length < 120) { notes.push({ heading: null, lines: [text] }); continue; }
      if (/^\*/.test(text) && paras.length) { paras[paras.length - 1].tips.push(text.replace(/^\*+\s*/, "")); continue; }
      if (isIngredientLine(text)) {
        let id = slug(text), n = 2;
        while (ids.has(id)) id = `${slug(text)}-${n++}`;
        ids.add(id);
        const q = text.match(QTY_RE);
        autoIngs.push({ id, raw: text, qty: q ? parseNum(q[1]) : null, qtyMax: q && q[2] ? parseNum(q[2]) : null, rest: q ? text.slice(q[0].length).trim() : text, group, keys: ingredientKeys(q ? text.slice(q[0].length) : text) });
        continue;
      }
      paras.push({ group, text, tips: [] });
    }

    // Long one-paragraph methods become several steps.
    const fewParas = paras.length <= 2;
    const autoSteps = [];
    for (const p of paras) {
      const sentenceCount = splitSentences(p.text).length;
      const pieces = (fewParas && sentenceCount > 3) || p.text.length > 700 ? chunkParagraph(p.text) : [p.text];
      pieces.forEach((txt, i) => autoSteps.push({ group: p.group, text: txt, tips: i === pieces.length - 1 ? p.tips : [] }));
    }
    // Only label steps with their group (e.g. "Sauce") when the method
    // actually spans more than one group.
    const showGroups = new Set(autoSteps.map(s => s.group || "")).size > 1;

    const cook = recipe.cook || {};
    const ingredients = Array.isArray(cook.ingredients)
      ? cook.ingredients.map(i => ({ id: i.id, raw: null, qty: i.qty ?? null, qtyMax: i.qtyMax ?? null, rest: [i.unit, i.item].filter(Boolean).join(" "), group: i.group || null, keys: ingredientKeys(i.item || i.text || ""), text: i.text || null }))
      : autoIngs;
    const byId = new Map(ingredients.map(i => [i.id, i]));

    const sourceSteps = Array.isArray(cook.steps) && cook.steps.length
      ? cook.steps.map(s => ({ group: s.group || null, text: s.text || "", tips: s.tip ? [s.tip] : [], explicit: s }))
      : autoSteps.map(s => ({ ...s, group: showGroups ? s.group : null, explicit: {} }));

    const steps = sourceSteps.map((s, idx) => {
      const ex = s.explicit;
      const title = ex.title || autoTitle(s.text);
      let timers;
      if ("timer" in ex || "timers" in ex) timers = normalizeTimers(ex.timers !== undefined ? ex.timers : ex.timer);
      else { const found = detectTimers(s.text); timers = found.map((t, i) => ({ min: t.min, max: t.max, note: t.note, label: timerLabel(s.text, found, i) })); }
      timers = timers.map((t, i) => ({ ...t, key: `s${idx}t${i}`, label: t.label || title }));
      const ingIds = Array.isArray(ex.ingredients) ? ex.ingredients.filter(id => byId.has(id)) : matchIngredients(s.text, ingredients);
      return { title, text: s.text, group: s.group, tips: s.tips || [], timers, ingIds, cue: ex.cue || null, batchNote: ex.batchNote || null };
    });

    // Size: explicit servings, else a plain "Serves N" in the text, else batch size.
    let servings = typeof cook.servings === "number" ? cook.servings : null;
    let yieldText = cook.yield || null;
    if (servings === null && !yieldText) {
      const sm = String(recipe.body).match(/\bserves\s+(\d+|two|three|four|five|six|eight|ten|twelve)(\s*(?:-|to)\s*\d+)?\b/i);
      if (sm && !sm[2]) servings = dnum(sm[1]);
      const y = notes.find(n => n.heading === null && YIELD_RE.test(n.lines[0]));
      if (y) yieldText = y.lines[0].replace(/^\(|\)$/g, "");
      else if (sm && sm[2]) yieldText = sm[0];
    }
    return { ingredients, byId, steps, notes: notes.filter(n => n.lines.length), servings, yieldText };
  }

  function normalizeTimers(v) {
    if (v === null || v === undefined || v === false) return [];
    const list = Array.isArray(v) ? v : [v];
    return list.map(t => {
      if (typeof t === "number") return { min: t, max: null, note: null, label: null };
      return { min: t.min ?? t.seconds ?? 0, max: t.max ?? null, note: t.note ?? null, label: t.label ?? null };
    }).filter(t => t.min > 0);
  }

  // ── Saved state ─────────────────────────────────────────────────────────
  function blankState() { return { step: 0, checked: {}, scale: 1, servings: null, timers: [], updatedAt: Date.now() }; }
  function loadState(key) {
    // If the timer engine is already tracking this recipe, share its copy so
    // the screen and the engine never disagree about a timer.
    const live = Engine.states.get(key);
    if (live) return live;
    const s = store.get(KEY_PREFIX + key);
    return s && typeof s === "object" ? Object.assign(blankState(), s) : blankState();
  }
  function saveState(key, state) { state.updatedAt = Date.now(); store.set(KEY_PREFIX + key, state); Engine.note(key, state); }
  function remaining(t, now) { return t.state === "running" ? t.endAt - now : t.state === "paused" ? t.remainingMs : t.state === "done" ? 0 : t.min * 1000; }

  // ── Alerts: sound, vibration, notification ──────────────────────────────
  let audioCtx = null;
  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
  }
  // Phones only allow sound after the person has tapped the page, so any tap
  // or key press "unlocks" it for timers that finish later.
  ["pointerdown", "touchend", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (Engine.states.size || UI.open) unlockAudio(); }, { passive: true }));
  function beep() {
    try {
      if (!audioCtx) unlockAudio();
      if (!audioCtx) return;
      const t0 = audioCtx.currentTime + 0.05;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        const start = t0 + r * 1.6 + i * 0.28;
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = "sine"; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start); osc.stop(start + 0.22);
      }
    } catch (e) {}
  }
  let swReg = null;
  // Tapping a timer notification brings the page forward and opens cook mode.
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "open" && e.data.hash) location.hash = e.data.hash; });
      // Reuse the worker if it was registered on an earlier visit.
      navigator.serviceWorker.getRegistration().then(r => { if (r) swReg = r; }).catch(() => {});
    }
  } catch (e) {}
  function prepareNotifications() {
    try {
      if ("serviceWorker" in navigator && !swReg) {
        navigator.serviceWorker.register("sw.js").then(r => { swReg = r; }).catch(() => {});
      }
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch (e) {}
  }
  function notify(title, body, url) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const opts = { body, tag: "swensen-timer-" + body, renotify: true, icon: "icon-192.png", data: { url } };
      if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
      else new Notification(title, opts);
    } catch (e) {}
  }

  // ── Timer engine (runs site-wide, even when cook mode is closed) ────────
  const Engine = {
    states: new Map(),          // recipeKey → state with at least one live timer
    titles: new Map(),          // recipeKey → { title, id } for alerts
    ticker: null,
    boot() {
      for (const k of store.keys()) {
        const st = store.get(k);
        if (st && Array.isArray(st.timers) && st.timers.some(t => t.state === "running" || (t.state === "done" && !t.ack))) this.states.set(k.slice(KEY_PREFIX.length), st);
      }
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.check(); });
      window.addEventListener("focus", () => this.check());
      this.check();
      this.ensureTicker();
    },
    note(key, state) {
      if (state.timers.some(t => t.state === "running" || (t.state === "done" && !t.ack))) this.states.set(key, state);
      else this.states.delete(key);
      this.ensureTicker();
    },
    ensureTicker() {
      const need = this.states.size > 0 || UI.open;
      if (need && !this.ticker) this.ticker = setInterval(() => this.check(), 1000);
      if (!need && this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    },
    check() {
      const now = Date.now();
      for (const [key, st] of this.states) {
        let changed = false;
        for (const t of st.timers) {
          if (t.state === "running" && t.endAt <= now) { t.state = "done"; t.doneAt = t.endAt; t.ack = false; changed = true; this.alert(key, t, now, st); }
        }
        if (changed) { st.updatedAt = now; store.set(KEY_PREFIX + key, st); }
      }
      UI.tick(now);
    },
    alert(key, t, now, st) {
      const late = now - t.doneAt > 15000;
      const what = t.max ? "Check now" : "Done";
      const info = this.titles.get(key) || { title: st && st.title, id: st && st.recipeId };
      beep();
      try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
      if (document.visibilityState !== "visible") notify(`⏰ ${what}: ${t.label} (step ${t.step + 1})`, info.title || "Swensen Family Cookbook", info.id ? `#/cook/${info.id}` : "#/");
      UI.announce(`${t.max ? "Time to check" : "Time's up"}: ${t.label}, step ${t.step + 1}${late ? `, finished ${Math.round((now - t.doneAt) / 60000)} minutes ago` : ""}`);
      UI.timerAlert(key, t, info);
    },
  };

  // ── Wake lock ───────────────────────────────────────────────────────────
  let wakeLock = null;
  async function keepAwake() {
    try { if ("wakeLock" in navigator && document.visibilityState === "visible" && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
  }
  function letSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
  document.addEventListener("visibilitychange", () => { if (UI.open && document.visibilityState === "visible") keepAwake(); });

  // ── The cook-mode screen ────────────────────────────────────────────────
  const SCALES = [0.5, 1, 1.5, 2, 3];
  const UI = {
    open: false, recipe: null, key: null, model: null, state: null, root: null,
    sheetOpen: false, backHash: null, showResume: false, alerts: [],

    openFor(recipe, source, opts) {
      if (this.open && this.key === (source.id)) { this.render(); return; }
      this.close(true);
      this.recipe = recipe; this.source = source; this.key = source.id;
      this.model = buildModel(source);
      this.state = loadState(this.key);
      this.state.step = Math.max(0, Math.min(this.state.step, this.model.steps.length));
      // Finished last time (and nothing still running)? Start fresh at step 1,
      // keeping the batch size.
      if (this.state.step >= this.model.steps.length && !this.state.timers.some(t => t.state === "running" || t.state === "paused")) {
        const keep = { scale: this.state.scale, servings: this.state.servings };
        this.state = Object.assign(blankState(), keep);
        saveState(this.key, this.state);
      }
      this.backHash = (opts && opts.backHash) || null;
      this.showResume = this.state.step > 0 || Object.keys(this.state.checked).length > 0 || this.state.timers.length > 0;
      Engine.titles.set(this.key, { title: source.title, id: recipe.id });
      // Saved with the progress so alerts can name the recipe even before
      // the recipe list has loaded (e.g. right after the phone wakes up).
      this.state.title = source.title; this.state.recipeId = recipe.id;
      this.open = true;
      this.mount();
      Toast.clear(this.key);
      this.state.timers.filter(t => t.state === "done" && t.ack === false).forEach(t => this.showAlertBanner(t));
      this.render();
      keepAwake();
      Engine.ensureTicker();
    },

    mount() {
      const root = document.createElement("div");
      root.className = "cm";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", `Cook mode: ${this.source.title}`);
      root.innerHTML = `
        <div class="cm-top">
          <button type="button" class="cm-topbtn" data-act="exit" aria-label="Exit cook mode">✕ <span>Exit</span></button>
          <div class="cm-top-title">${esc(this.source.title)}</div>
          <button type="button" class="cm-topbtn" data-act="restart" aria-label="Start over">↺ <span>Start over</span></button>
        </div>
        <div class="cm-progress"><div class="cm-progress-label"></div><div class="cm-bar" role="progressbar" aria-valuemin="0"><div class="cm-bar-fill"></div></div></div>
        <div class="cm-alerts" aria-live="off"></div>
        <main class="cm-stage" tabindex="-1"></main>
        <div class="cm-dock">
          <button type="button" class="cm-basket" data-act="sheet" aria-label="Ingredients and batch size" aria-expanded="false"><span aria-hidden="true">🧺</span><span class="cm-basket-count" aria-hidden="true"></span></button>
          <div class="cm-tray" role="region" aria-label="Timers"></div>
          <nav class="cm-nav" aria-label="Steps">
            <button type="button" class="cm-navbtn cm-prev" data-act="prev">‹ Back</button>
            <button type="button" class="cm-navbtn cm-next" data-act="next">Next ›</button>
          </nav>
        </div>
        <div class="cm-sheet" hidden role="dialog" aria-modal="true" aria-label="Ingredients"></div>
        <div class="cm-sr" aria-live="assertive" aria-atomic="true"></div>
        <div class="cm-sr cm-sr-polite" aria-live="polite" aria-atomic="true"></div>`;
      document.body.appendChild(root);
      this.root = root;
      document.documentElement.classList.add("cm-open");
      ["app", "site-header", "site-footer"].forEach(id => { const el = document.getElementById(id) || document.querySelector("." + id); if (el) el.setAttribute("inert", ""); });

      root.addEventListener("click", e => this.onClick(e));
      root.addEventListener("change", e => this.onChange(e));
      this._key = e => this.onKey(e);
      document.addEventListener("keydown", this._key);
      // Swipe left / right on the step area
      const stage = $(".cm-stage", root);
      let sx = 0, sy = 0, tracking = false;
      stage.addEventListener("touchstart", e => { if (e.touches.length !== 1) return; tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      stage.addEventListener("touchend", e => {
        if (!tracking) return; tracking = false;
        const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(dx < 0 ? 1 : -1);
      }, { passive: true });
    },

    close(silent) {
      if (!this.open) return;
      this.open = false;
      document.removeEventListener("keydown", this._key);
      if (this.root) this.root.remove();
      this.root = null;
      document.documentElement.classList.remove("cm-open");
      ["app", "site-header", "site-footer"].forEach(id => { const el = document.getElementById(id) || document.querySelector("." + id); if (el) el.removeAttribute("inert"); });
      letSleep();
      Engine.ensureTicker();
    },

    // ── Scale ──
    scale() {
      if (this.model.servings && this.state.servings) return this.state.servings / this.model.servings;
      return this.state.scale || 1;
    },
    scaleLabel() {
      if (this.model.servings) return `Serves ${this.state.servings || this.model.servings}`;
      const s = this.state.scale || 1;
      return `${fmtNum(s)}× batch`;
    },
    ingText(ing) {
      const s = this.scale();
      if (ing.qty === null || ing.qty === undefined) return ing.raw || ing.text || ing.rest;
      if (s === 1 && ing.raw) return ing.raw;
      const a = fmtNum(ing.qty * s) + (ing.qtyMax ? ` to ${fmtNum(ing.qtyMax * s)}` : "");
      return `${a} ${fixUnit((ing.qtyMax || ing.qty) * s, ing.rest)}`.trim();
    },

    // ── Rendering ──
    // Remember which control has keyboard focus so a re-render can put it back.
    focusToken() {
      const a = document.activeElement;
      if (!a || !this.root || !this.root.contains(a) || a === this.root) return null;
      const chip = a.closest("[data-chip]");
      if (chip) return { chip: chip.dataset.chip, idx: Array.prototype.indexOf.call(chip.querySelectorAll("button"), a) };
      if (a.id) return { id: a.id };
      if (a.dataset && a.dataset.act) return { act: a.dataset.act, key: a.dataset.key || null, scale: a.dataset.scale || null };
      return null;
    },
    restoreFocus(tok) {
      if (!tok || !this.root) return;
      let el = null;
      if (tok.chip) {
        const chip = this.root.querySelector(`[data-chip="${tok.chip}"]`);
        if (chip) { const bs = chip.querySelectorAll("button"); el = bs[Math.max(0, Math.min(tok.idx, bs.length - 1))]; }
      } else if (tok.id) el = document.getElementById(tok.id);
      else if (tok.act) el = this.root.querySelector(`[data-act="${tok.act}"]${tok.key ? `[data-key="${tok.key}"]` : ""}${tok.scale ? `[data-scale="${tok.scale}"]` : ""}`);
      if (!el || el.closest("[hidden]")) el = $(".cm-step-title", this.root);
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    },

    render() {
      if (!this.open) return;
      const tok = this.focusToken();
      this._render();
      this.restoreFocus(tok);
    },
    _render() {
      const { steps } = this.model, n = steps.length, i = this.state.step, done = i >= n;
      $(".cm-progress-label", this.root).textContent = done ? `All ${n} steps done` : `Step ${i + 1} of ${n}`;
      const bar = $(".cm-bar", this.root);
      bar.setAttribute("aria-valuemax", n); bar.setAttribute("aria-valuenow", Math.min(i + 1, n));
      bar.setAttribute("aria-label", done ? "Finished" : `Step ${i + 1} of ${n}`);
      $(".cm-bar-fill", this.root).style.width = `${(Math.min(i + 1, n) / n) * 100}%`;
      $(".cm-prev", this.root).disabled = i === 0;
      const next = $(".cm-next", this.root);
      next.textContent = done ? "Back to recipe" : i === n - 1 ? "Finish ✓" : "Next ›";
      next.dataset.act = done ? "exit" : "next";
      $(".cm-stage", this.root).innerHTML = done ? this.doneHtml() : this.stepHtml(steps[i], i);
      this.renderTray(); this.renderBasket();
      if (this.sheetOpen) this.renderSheet();
    },

    stepHtml(step, i) {
      const s = this.scale();
      const resume = this.showResume ? `<div class="cm-resume"><span>Welcome back. Picking up at step ${i + 1}.</span><button type="button" data-act="restart">Start over</button><button type="button" data-act="dismiss-resume" aria-label="Dismiss">✕</button></div>` : "";
      const ings = step.ingIds.map(id => this.model.byId.get(id)).filter(Boolean);
      const ingHtml = ings.length ? `
        <section class="cm-ings" aria-label="Ingredients for this step">
          <h3>You'll need${s !== 1 ? ` <span class="cm-scale-tag">${esc(this.scaleLabel())}</span>` : ""}</h3>
          <ul>${ings.map(ing => this.ingItemHtml(ing, "step")).join("")}</ul>
        </section>` : "";
      const timerHtml = step.timers.length ? `
        <div class="cm-timers">
          ${step.timers.map(t => this.timerButtonHtml(t, step.timers.length > 1)).join("")}
          <p class="cm-phone-hint">${this.phoneHint(step.timers)}</p>
        </div>` : "";
      const batch = s > 1 ? (step.batchNote ? `<p class="cm-batch"><strong>Bigger batch:</strong> ${inline(step.batchNote)}</p>` : step.timers.length ? `<p class="cm-batch">Bigger batch? Go by how it looks, it may take longer.</p>` : "") : "";
      return `${resume}
        <article class="cm-step">
          ${step.group ? `<div class="cm-eyebrow">${esc(step.group)}</div>` : ""}
          <h2 class="cm-step-title" tabindex="-1">${esc(step.title)}</h2>
          <p class="cm-step-text">${inline(scaleText(step.text, s))}</p>
          ${step.tips.map(t => `<p class="cm-tip"><strong>Tip:</strong> ${inline(t)}</p>`).join("")}
          ${step.cue ? `<p class="cm-cue"><strong>Look for:</strong> ${inline(step.cue)}</p>` : ""}
          ${batch}
          ${ingHtml}
          ${timerHtml}
        </article>`;
    },

    ingItemHtml(ing, where) {
      const checked = !!this.state.checked[ing.id];
      const id = `cm-${where}-${ing.id}`;
      return `<li class="${checked ? "is-checked" : ""}"><input type="checkbox" id="${id}" data-ing="${esc(ing.id)}" ${checked ? "checked" : ""}><label for="${id}">${inline(this.ingText(ing))}</label></li>`;
    },

    // Plain-text fallback for anyone leaving the kitchen.
    phoneHint(timers) {
      const one = t => `${fmtDurLong(t.min)}${t.max ? ", then check" : ""}`;
      if (timers.length === 1) return `Stepping away? Set a timer on your phone for ${esc(one(timers[0]))}.`;
      return `Stepping away? Set a timer on your phone. ${timers.map(t => `${esc(t.label)}: ${esc(one(t))}.`).join(" ")}`;
    },
    timerButtonHtml(t, named) {
      const live = this.state.timers.find(x => x.key === t.key && x.state !== "idle");
      const note = t.note ? ` (${esc(t.note)})` : "";
      const who = named ? `${esc(t.label)}: ` : "";
      if (live && live.state === "running") return `<button type="button" class="cm-timer-btn is-running" data-act="focus-tray" data-key="${t.key}">⏱ ${who}Running <span data-countdown="${t.key}">${fmtClock(live.endAt - Date.now())}</span></button>`;
      if (live && live.state === "paused") return `<button type="button" class="cm-timer-btn is-running" data-act="focus-tray" data-key="${t.key}">⏱ ${who}Paused <span>${fmtClock(live.remainingMs)}</span></button>`;
      const lead = named ? (live && live.state === "done" ? `⏱ Restart: ${esc(t.label)}` : `⏱ ${esc(t.label)}`)
                         : (live && live.state === "done" ? "⏱ Restart timer" : "⏱ Start timer");
      return `<button type="button" class="cm-timer-btn" data-act="start-timer" data-key="${t.key}">${lead} · ${esc(rangeLabel(t))}${note}</button>`;
    },

    doneHtml() {
      const notes = this.model.notes.map(n => `
        <section class="cm-note">${n.heading ? `<h3>${esc(n.heading)}</h3>` : ""}${n.lines.map(l => `<p>${inline(l)}</p>`).join("")}</section>`).join("");
      return `
        <article class="cm-step cm-done">
          <div class="cm-done-mark" aria-hidden="true">🎉</div>
          <h2 class="cm-step-title" tabindex="-1">All done!</h2>
          <p class="cm-step-text">Enjoy your ${esc(this.source.title)}.</p>
          ${notes ? `<div class="cm-notes"><h3 class="cm-notes-head">Good to know</h3>${notes}</div>` : ""}
          <div class="cm-done-actions">
            <button type="button" class="cm-btn cm-btn-ghost" data-act="restart">Start over</button>
          </div>
        </article>`;
    },

    renderTray() {
      const tray = $(".cm-tray", this.root);
      const timers = this.state.timers.filter(t => t.state !== "idle");
      tray.hidden = !timers.length;
      const now = Date.now();
      tray.innerHTML = timers.map(t => {
        const rem = remaining(t, now);
        const status = t.state === "done" ? (t.max ? "Check now" : "Done") : fmtClock(rem);
        const ctrl = t.state === "running"
          ? `<button type="button" data-act="pause" data-key="${t.key}" aria-label="Pause ${esc(t.label)}">❚❚</button>`
          : t.state === "paused" ? `<button type="button" data-act="resume" data-key="${t.key}" aria-label="Resume ${esc(t.label)}">▶</button>` : "";
        return `<div class="cm-chip is-${t.state}${t.state === "done" && !t.ack ? " is-ringing" : ""}" data-chip="${t.key}">
          <button type="button" class="cm-chip-main" data-act="goto-step" data-step="${t.step}" aria-label="${esc(t.label)}, ${esc(status)}. Go to step ${t.step + 1}">
            <span class="cm-chip-label">Step ${t.step + 1} · ${esc(t.label)}</span>
            <span class="cm-chip-time" data-countdown="${t.key}">${esc(status)}</span>
          </button>
          ${ctrl}
          <button type="button" data-act="add-min" data-key="${t.key}" aria-label="Add 1 minute to ${esc(t.label)}">+1</button>
          ${t.state === "done" ? `<button type="button" data-act="dismiss" data-key="${t.key}" aria-label="Clear ${esc(t.label)}">✕</button>` : `<button type="button" data-act="reset" data-key="${t.key}" aria-label="Reset ${esc(t.label)}">↺</button>`}
        </div>`;
      }).join("");
    },

    renderBasket() {
      const total = this.model.ingredients.length, got = this.model.ingredients.filter(i => this.state.checked[i.id]).length;
      const c = $(".cm-basket-count", this.root);
      c.textContent = total ? `${got}/${total}` : "";
      $(".cm-basket", this.root).hidden = !total;
    },

    renderSheet() {
      const sheet = $(".cm-sheet", this.root);
      const m = this.model;
      let scaleHtml;
      if (m.servings) {
        const cur = this.state.servings || m.servings;
        scaleHtml = `<div class="cm-scale"><span>Serves</span>
          <button type="button" data-act="serv-down" aria-label="Fewer servings" ${cur <= 1 ? "disabled" : ""}>−</button>
          <strong aria-live="polite">${cur}</strong>
          <button type="button" data-act="serv-up" aria-label="More servings">+</button></div>`;
      } else {
        const cur = this.state.scale || 1;
        scaleHtml = `<div class="cm-scale" role="group" aria-label="Batch size"><span>Batch</span>${SCALES.map(s => `<button type="button" data-act="scale" data-scale="${s}" aria-pressed="${s === cur}">${fmtNum(s)}×</button>`).join("")}</div>`;
      }
      let lastGroup = null, list = "";
      for (const ing of m.ingredients) {
        if (ing.group && ing.group !== lastGroup) { list += `<li class="cm-group">${esc(ing.group)}</li>`; lastGroup = ing.group; }
        list += this.ingItemHtml(ing, "sheet");
      }
      sheet.innerHTML = `
        <div class="cm-sheet-panel">
          <div class="cm-sheet-head"><h2>Ingredients</h2><button type="button" class="cm-topbtn" data-act="sheet-close" aria-label="Close ingredients">Done</button></div>
          ${scaleHtml}
          ${m.yieldText ? `<p class="cm-yield">Original recipe: ${esc(m.yieldText)}</p>` : ""}
          <ul class="cm-sheet-list">${list}</ul>
          ${Object.keys(this.state.checked).length ? `<button type="button" class="cm-btn cm-btn-ghost cm-uncheck" data-act="uncheck">Uncheck all</button>` : ""}
        </div>`;
    },

    tick(now) {
      if (!this.open) return;
      for (const el of this.root.querySelectorAll("[data-countdown]")) {
        const t = this.state.timers.find(x => x.key === el.dataset.countdown);
        if (!t) continue;
        el.textContent = t.state === "done" ? (t.max ? "Check now" : "Done") : fmtClock(remaining(t, now));
      }
    },

    // ── Timers ──
    stepTimer(key) {
      for (const st of this.model.steps) for (const t of st.timers) if (t.key === key) return t;
      return null;
    },
    startTimer(key) {
      const def = this.stepTimer(key); if (!def) return;
      unlockAudio(); prepareNotifications();
      const stepIdx = this.model.steps.findIndex(s => s.timers.includes(def));
      this.state.timers = this.state.timers.filter(t => t.key !== key);
      this.state.timers.push({ key, step: stepIdx, label: def.label, min: def.min, max: def.max, state: "running", endAt: Date.now() + def.min * 1000, remainingMs: null, ack: true });
      this.persist();
      this.politeAnnounce(`Timer started: ${def.label}, ${fmtDurLong(def.min)}`);
    },
    timerAction(act, key) {
      const t = this.state.timers.find(x => x.key === key); if (!t) return;
      const now = Date.now();
      unlockAudio();
      if (act === "pause" && t.state === "running") { t.remainingMs = Math.max(0, t.endAt - now); t.state = "paused"; t.endAt = null; }
      else if (act === "resume" && t.state === "paused") { t.endAt = now + t.remainingMs; t.state = "running"; t.remainingMs = null; }
      else if (act === "add-min") {
        if (t.state === "running") t.endAt += 60000;
        else if (t.state === "paused") t.remainingMs += 60000;
        else { t.state = "running"; t.endAt = now + 60000; t.ack = true; }
        this.clearAlert(key);
      } else if (act === "reset") { this.state.timers = this.state.timers.filter(x => x.key !== key); this.clearAlert(key); }
      else if (act === "dismiss") { this.state.timers = this.state.timers.filter(x => x.key !== key); this.clearAlert(key); }
      this.persist();
    },
    persist() { saveState(this.key, this.state); this.render(); },

    // Big banner when a timer finishes.  For other recipes (or when cook mode
    // is closed) a small toast appears instead.
    timerAlert(key, t, info) {
      if (this.open && key === this.key) {
        const st = this.state.timers.find(x => x.key === t.key); if (st) { st.state = "done"; st.doneAt = t.doneAt; st.ack = false; }
        this.showAlertBanner(st || t);
        this.render();
      } else {
        Toast.show(key, t, info);
      }
    },
    showAlertBanner(t) {
      const box = $(".cm-alerts", this.root);
      if (!box || box.querySelector(`[data-alert="${t.key}"]`)) return;
      const ago = Date.now() - (t.doneAt || Date.now());
      const agoText = ago > 60000 ? ` · ${fmtDurShort(Math.round(ago / 60000) * 60)} ago` : "";
      const el = document.createElement("div");
      el.className = "cm-alert"; el.dataset.alert = t.key;
      el.innerHTML = `<div><strong>⏰ ${t.max ? "Check now" : "Time's up"}</strong><span>Step ${t.step + 1} · ${esc(t.label)}${agoText}</span></div>
        <button type="button" data-act="add-min" data-key="${t.key}">+1 min</button>
        <button type="button" data-act="ack" data-key="${t.key}">OK</button>`;
      box.appendChild(el);
      this.root.classList.add("is-flashing");
    },
    clearAlert(key) {
      if (!this.root) return;
      const el = this.root.querySelector(`[data-alert="${key}"]`); if (el) el.remove();
      const t = this.state.timers.find(x => x.key === key); if (t) t.ack = true;
      if (!this.root.querySelector(".cm-alert")) this.root.classList.remove("is-flashing");
    },

    announce(msg) { const el = this.root && $(".cm-sr", this.root); if (el) { el.textContent = ""; setTimeout(() => { el.textContent = msg; }, 50); } else Toast.announce(msg); },
    politeAnnounce(msg) { const el = this.root && $(".cm-sr-polite", this.root); if (el) { el.textContent = ""; setTimeout(() => { el.textContent = msg; }, 50); } },

    // ── Navigation ──
    go(delta) {
      if (this.sheetOpen) return;
      const n = this.model.steps.length;
      const next = Math.max(0, Math.min(n, this.state.step + delta));
      if (next === this.state.step) return;
      this.state.step = next; this.showResume = false;
      this.persist();          // re-render keeps focus on Next/Back when it still exists
      const stage = $(".cm-stage", this.root); stage.scrollTop = 0;
      this.politeAnnounce(next >= n ? "All steps done" : `Step ${next + 1} of ${n}: ${this.model.steps[next].title}`);
    },
    exit() {
      const running = this.state.timers.filter(t => t.state === "running").length;
      if (running && !window.confirm(`You have ${running} timer${running === 1 ? "" : "s"} running. ${running === 1 ? "It" : "They"}'ll keep counting, and you'll see ${running === 1 ? "it" : "them"} when you come back. Leave cook mode?`)) return;
      const recipeHash = `#/recipe/${encodeURIComponent(this.recipe.id)}`;
      if (this.backHash === recipeHash) history.back(); else location.hash = recipeHash;
    },
    restart() {
      const running = this.state.timers.filter(t => t.state === "running").length;
      if (!window.confirm(running ? `Start over? This clears your progress, checked ingredients, and ${running} running timer${running === 1 ? "" : "s"}.` : "Start over from step 1? This clears your progress and checked ingredients.")) return;
      const keep = { scale: this.state.scale, servings: this.state.servings };
      this.state = Object.assign(blankState(), keep);
      this.showResume = false;
      if (this.root) { $(".cm-alerts", this.root).innerHTML = ""; this.root.classList.remove("is-flashing"); }
      this.persist();
      const h = $(".cm-step-title", this.root); if (h) h.focus();
    },
    toggleSheet(open) {
      this.sheetOpen = open;
      const sheet = $(".cm-sheet", this.root), btn = $(".cm-basket", this.root);
      btn.setAttribute("aria-expanded", String(open));
      if (open) { this.renderSheet(); sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add("is-open")); const c = sheet.querySelector("[data-act='sheet-close']"); if (c) c.focus(); }
      else { sheet.classList.remove("is-open"); sheet.hidden = true; btn.focus(); this.render(); }
    },

    // ── Events ──
    onClick(e) {
      const b = e.target.closest("[data-act]"); if (!b || !this.root.contains(b)) return;
      if (e.target === $(".cm-sheet", this.root)) { this.toggleSheet(false); return; }
      const act = b.dataset.act, key = b.dataset.key;
      if (act === "next") this.go(1);
      else if (act === "prev") this.go(-1);
      else if (act === "exit") this.exit();
      else if (act === "restart") this.restart();
      else if (act === "dismiss-resume") { this.showResume = false; this.render(); }
      else if (act === "sheet") this.toggleSheet(true);
      else if (act === "sheet-close") this.toggleSheet(false);
      else if (act === "start-timer") this.startTimer(key);
      else if (act === "focus-tray") { const c = this.root.querySelector(`[data-chip="${key}"] button`); if (c) c.focus(); }
      else if (act === "goto-step") { const s = +b.dataset.step; if (s !== this.state.step) { this.state.step = s; this.persist(); } }
      else if (act === "ack") { this.clearAlert(key); this.persist(); }
      else if (["pause", "resume", "add-min", "reset", "dismiss"].includes(act)) this.timerAction(act, key);
      else if (act === "scale") { this.state.scale = +b.dataset.scale; this.persist(); }
      else if (act === "serv-up" || act === "serv-down") {
        const cur = this.state.servings || this.model.servings;
        this.state.servings = Math.max(1, cur + (act === "serv-up" ? 1 : -1)); this.persist();
      } else if (act === "uncheck") { this.state.checked = {}; this.persist(); }
    },
    onChange(e) {
      const id = e.target.dataset && e.target.dataset.ing; if (!id) return;
      if (e.target.checked) this.state.checked[id] = true; else delete this.state.checked[id];
      saveState(this.key, this.state);
      for (const li of this.root.querySelectorAll(`input[data-ing="${CSS.escape(id)}"]`)) { li.checked = e.target.checked; li.closest("li").classList.toggle("is-checked", e.target.checked); }
      this.renderBasket();
    },
    onKey(e) {
      if (!this.open) return;
      if (e.key === "Escape") { e.preventDefault(); if (this.sheetOpen) this.toggleSheet(false); else this.exit(); return; }
      if (this.sheetOpen) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); this.go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); this.go(-1); }
    },
  };

  // Small toast for timers that finish while cook mode for that recipe isn't open.
  const Toast = {
    el: null,
    ensure() {
      if (this.el) return this.el;
      this.el = document.createElement("div");
      this.el.className = "cm-toasts";
      this.el.setAttribute("aria-live", "assertive");
      document.body.appendChild(this.el);
      this.el.addEventListener("click", e => {
        const b = e.target.closest("[data-toast-act]"); if (!b) return;
        const key = b.dataset.key, tkey = b.dataset.tkey;
        const st = store.get(KEY_PREFIX + key);
        if (st) { const t = st.timers.find(x => x.key === tkey); if (t) t.ack = true; store.set(KEY_PREFIX + key, st); Engine.note(key, st); }
        b.closest(".cm-toast").remove();
      });
      return this.el;
    },
    show(key, t, info) {
      const box = this.ensure();
      if (box.querySelector(`[data-toast="${key}:${t.key}"]`)) return;
      const div = document.createElement("div");
      div.className = "cm-toast"; div.dataset.toast = `${key}:${t.key}`;
      const href = info && info.id ? `#/cook/${encodeURIComponent(info.id)}` : "#/";
      div.innerHTML = `<div><strong>⏰ ${t.max ? "Check now" : "Time's up"}: ${esc(t.label)} (step ${t.step + 1})</strong>${info && info.title ? `<span>${esc(info.title)}</span>` : ""}</div>
        <a href="${href}" data-toast-act="open" data-key="${esc(key)}" data-tkey="${esc(t.key)}">Back to cooking</a>
        <button type="button" data-toast-act="ok" data-key="${esc(key)}" data-tkey="${esc(t.key)}" aria-label="Dismiss">✕</button>`;
      box.appendChild(div);
    },
    announce() { /* the toast itself sits in a live region, so it is read out when it appears */ },
    clear(key) { if (this.el) this.el.querySelectorAll(`[data-toast^="${CSS.escape(key)}:"]`).forEach(el => el.remove()); },
  };

  // ── Public API used by app.js ───────────────────────────────────────────
  let lookup = () => null;
  function sourceOf(recipe) { return (recipe && recipe._source_id && lookup(recipe._source_id)) || recipe; }

  window.CookMode = {
    setLookup(fn) { lookup = fn; },
    // Guide pages (How to Sous Vide, Meat Temperature Guide) and entries with
    // no instructions don't get a Start cooking button.
    canCook(recipe) {
      const src = sourceOf(recipe);
      if (!src || (src.subsection && src.subsection === src.title)) return false;
      try { return buildModel(src).steps.length > 0; } catch (e) { return false; }
    },
    // Returns {step, total} when there's an unfinished saved session.
    progress(recipe) {
      const src = sourceOf(recipe);
      const st = store.get(KEY_PREFIX + src.id);
      if (!st || !st.step) return null;
      const total = buildModel(src).steps.length;
      return st.step < total ? { step: st.step + 1, total } : null;
    },
    open(recipe, opts) { UI.openFor(recipe, sourceOf(recipe), opts); },
    close() { UI.close(); },
    isOpen() { return UI.open; },
    _buildModel: buildModel,     // exposed for testing / the backfill script
    _fmt: { rangeLabel, fmtDurShort, fmtDurLong, fmtNum, scaleText },
  };

  Engine.boot();
})();
