/**
 * SBO:Rebirth Wiki — template and table parsers
 * Parses MediaWiki wikitext from the Fandom wiki.
 */

/**
 * Extract key=value pairs from a MediaWiki template.
 * Handles multi-line templates: {{Name | key=value | key2=value2 }}
 * @param {string} wikitext - Full page wikitext
 * @param {string} templateName - Template name (e.g. "Weapon", "Armor", "Mobs")
 * @returns {Object|null} Parsed params or null if not found
 */
function parseTemplate(wikitext, templateName) {
  const start = new RegExp(`\\{\\{${templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`, 'i');
  const m = wikitext.match(start);
  if (!m) return null;
  let i = m.index + m[0].length - 1;
  let depth = 1;
  while (i < wikitext.length && depth > 0) {
    i++;
    const c2 = wikitext.slice(i, i + 2);
    if (c2 === '{{' || c2 === '[[') depth++;
    if (c2 === '}}' || c2 === ']]') depth--;
  }
  const inner = wikitext.slice(m.index + m[0].length, depth === 0 ? i - 2 : wikitext.length);
  const params = {};
  // Split by | but not inside nested {{ }} or [[ ]]
  let nestDepth = 0;
  let current = '';
  let key = null;

  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    const c2 = inner.slice(j, j + 2);
    if (c2 === '{{' || c2 === '[[') nestDepth++;
    if (c2 === '}}' || c2 === ']]') nestDepth--;
    if ((c === '|' && nestDepth === 0) || (c === '\n' && nestDepth === 0 && inner[j - 1] === '|')) {
      const part = current.trim();
      if (part) {
        const eq = part.indexOf('=');
        if (eq > 0) {
          key = part.slice(0, eq).trim().toLowerCase().replace(/\s/g, '_');
          let val = part.slice(eq + 1).trim();
          val = stripWikiMarkup(val);
          params[key] = val;
        } else if (key) {
          params[key] = (params[key] || '') + ' ' + stripWikiMarkup(part);
        }
      }
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) {
    const eq = current.indexOf('=');
    if (eq > 0) {
      const k = current.slice(0, eq).trim().toLowerCase().replace(/\s/g, '_');
      params[k] = stripWikiMarkup(current.slice(eq + 1).trim());
    }
  }
  return params;
}

/**
 * Strip basic MediaWiki markup: [[link|text]] → text, '''bold''' → text.
 * Handles partial [[link|text when ]] is missing (extract text after |).
 */
function stripWikiMarkup(s) {
  if (!s || typeof s !== 'string') return '';
  let out = s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]|]*)(?:\]\]|$)/g, '$2')
    .replace(/'''?/g, '')
    .replace(/''/g, '')
    .trim();
  return out;
}

/**
 * Extract numeric skill from strings like "Skill 1", "75", "270 [Max]"
 */
function parseSkillLevel(str) {
  if (!str) return { skill: null, isMax: false };
  const s = String(str).trim();
  const maxMatch = s.match(/\[Max\]/i);
  const numMatch = s.match(/(\d+)/);
  return {
    skill: numMatch ? parseInt(numMatch[1], 10) : null,
    isMax: !!maxMatch,
  };
}

/**
 * Extract ATK from strings like "3 ATK", "65"
 */
function parseDamage(str) {
  if (!str) return null;
  const m = String(str).match(/(\d+)\s*ATK/i) || String(str).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extract Col value from "231 Col" or "480"
 */
function parseCol(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, '').match(/(\d+)\s*Col/i) || String(str).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extract numeric value, handling [Max] suffix and commas
 */
function parseNumber(str) {
  if (!str) return null;
  const s = String(str).replace(/,/g, '').replace(/\s*\[Max\].*$/i, '').trim();
  const m = s.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Parse wikitable into array of row objects.
 * First row is treated as headers. Returns array of { headers, rows }.
 */
function parseWikitable(wikitext) {
  const tables = [];
  const tableRegex = /\{\|\s*[^|]*([\s\S]*?)\|\}/g;
  let m;
  while ((m = tableRegex.exec(wikitext)) !== null) {
    const tableContent = m[1];
    const rawRows = tableContent.split(/\|-/).map((r) => r.trim()).filter(Boolean);
    let headers = null;
    const rows = [];

    for (const raw of rawRows) {
      const cells = raw
        .split(/\|/)
        .map((s) => s.replace(/^!+\s*/, '').trim())
        .filter((s) => s.length > 0)
        .map(stripWikiMarkup);
      if (cells.length === 0) continue;

      if (!headers) {
        headers = cells;
        continue;
      }
      if (headers.length > 0 && cells.length >= 1) {
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cells[i] ?? '';
        });
        rows.push(row);
      }
    }
    if (rows.length > 0) {
      tables.push({ headers: headers || [], rows });
    }
  }
  return tables;
}

/**
 * Parse Weapon template into structured object for planner
 */
function parseWeaponTemplate(params, pageTitle) {
  const damage = parseDamage(params.damage);
  const { skill, isMax } = parseSkillLevel(params.skill_level);
  const colValue = parseCol(params.col_value);
  return {
    name: (params.title1 || pageTitle || '').trim(),
    attack: damage,
    skillReq: skill,
    skillMax: isMax,
    colValue,
    location: stripWikiMarkup(params.location || ''),
    weaponType: stripWikiMarkup(params.weapon_type || ''),
    raw: params,
  };
}

/**
 * Parse Armor template (used for armor and shields)
 */
function parseArmorTemplate(params, pageTitle) {
  const level = parseNumber(params.level_req);
  const defense = parseNumber(params.defense);
  const dexterity = parseNumber(params.dexterity);
  const worth = parseCol(params.worth);
  return {
    name: (params.title1 || pageTitle || '').trim(),
    levelReq: level,
    defense,
    dexterity,
    worth,
    howToObtain: stripWikiMarkup(params.how_to_obtain || params.location || ''),
    raw: params,
  };
}

/**
 * Parse Mobs template (used for bosses)
 */
function parseMobsTemplate(params, pageTitle) {
  const maxHealth = parseNumber((params.max_health || '').replace(/,/g, ''));
  const level = parseNumber(params.level);
  const row4 = parseNumber(params.row4);
  const row5 = parseNumber(params.row5);
  let name = (params.title1 || pageTitle || '').replace(/\{\{PAGENAME\}\}/g, pageTitle || '').trim();
  if (!name || name.includes('{{') || name.includes('PAGENAME')) name = pageTitle || name;
  return {
    name,
    hp: maxHealth,
    recLevel: level,
    exp: row4,
    col: row5,
    respawn: params.row1 || '',
    location: params.row3 || '',
    drops: params.drops || '',
    rareDrops: params.rare_drops || '',
    lastHitBonus: params.last_hit_bonus || '',
    raw: params,
  };
}

module.exports = {
  parseTemplate,
  stripWikiMarkup,
  parseSkillLevel,
  parseDamage,
  parseCol,
  parseNumber,
  parseWikitable,
  parseWeaponTemplate,
  parseArmorTemplate,
  parseMobsTemplate,
};
