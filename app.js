/* GoBag — reusable packing templates for trips and everyday outings. */
(() => {
  'use strict';

  const STORE_KEY = 'gobag.v1';

  /* ------------------------------------------------------------------ *
   * Starter templates
   * ------------------------------------------------------------------ */

  const SEED_TEMPLATES = [
    {
      name: 'Swimming',
      emoji: '\u{1F3CA}',
      text: `Swimsuit
Towel
Goggles
Swim cap
Flip flops
Lock for the locker
Shampoo & body wash
Water bottle
Bag for wet things`,
    },
    {
      name: 'Beach day',
      emoji: '\u{1F3D6}\u{FE0F}',
      text: `# Wear
Swimsuit
Towels
Flip flops
Sunglasses
Hat

# Sun
Sunscreen
Aftersun
Umbrella or shade

# Comfort
Beach chairs
Blanket
Cooler
Water
Snacks
Book
Speaker

# After
Change of clothes
Bag for wet things
Bin bag`,
    },
    {
      name: 'Gym',
      emoji: '\u{1F3CB}\u{FE0F}',
      text: `Trainers
Shorts
T-shirt
Socks
Towel
Water bottle
Headphones
Padlock
Deodorant`,
    },
    {
      name: 'Day hike',
      emoji: '\u{1F97E}',
      text: `# Wear
Hiking boots
Wool socks
Rain jacket
Hat

# Carry
Daypack
Water (2L)
Lunch & snacks
Map or downloaded route
Phone + power bank
First aid kit
Sunscreen
Bug spray
Headlamp`,
    },
    {
      name: 'Camping',
      emoji: '\u{26FA}',
      text: `# Shelter
Tent
Stakes & guylines
Groundsheet
Mallet

# Sleep
Sleeping bag
Sleeping pad
Pillow

# Kitchen
Camp stove
Fuel
Lighter & matches
Pot & pan
Utensils
Plates & mugs
Cooler
Food
Water jug
Dish soap & sponge
Bin bags

# Light & power
Headlamp
Lantern
Power bank
Spare batteries

# Clothing
Warm layer
Rain jacket
Sturdy shoes
Camp shoes
Socks & underwear

# Essentials
First aid kit
Sunscreen
Bug spray
Toilet paper
Towel
Multi-tool`,
    },
    {
      name: 'Week in Europe',
      emoji: '\u{2708}\u{FE0F}',
      text: `# Documents
Passport
Boarding passes
Travel insurance
Bank cards
Some local cash
Copies of documents

# Electronics
Phone + charger
Plug adapter
Power bank
Headphones
Camera

# Toiletries
Toothbrush & toothpaste
Deodorant
Shampoo (travel size)
Razor
Medication
Sunscreen
Contacts / glasses

# Clothes
7 x underwear
7 x socks
4 x t-shirts
2 x trousers
1 x jumper
Light jacket
Walking shoes
Nicer outfit for dinner
Pyjamas
Swimsuit

# Day bag
Reusable water bottle
Compact umbrella
Sunglasses
Snacks`,
    },
  ];

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>';
  const CHEV_SVG = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

  /** Parse the plain-text list format: "# Heading" starts a group, other lines are items. */
  function parseGroups(text) {
    const groups = [];
    let current = null;
    for (const rawLine of String(text).split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        current = { name: line.replace(/^#+\s*/, ''), items: [] };
        groups.push(current);
      } else {
        if (!current) {
          current = { name: '', items: [] };
          groups.push(current);
        }
        current.items.push(line);
      }
    }
    return groups.filter((g) => g.items.length > 0);
  }

  function groupsToText(groups) {
    return groups
      .map((g) => (g.name ? `# ${g.name}\n` : '') + g.items.map((i) => (typeof i === 'string' ? i : i.text)).join('\n'))
      .join('\n\n');
  }

  /** Merge one or more templates into pack groups, de-duplicating repeated items. */
  function buildPackGroups(templates) {
    const byName = new Map();
    const ordered = [];
    const seen = new Set();

    for (const template of templates) {
      for (const group of template.groups) {
        const key = group.name.toLowerCase();
        let target = byName.get(key);
        if (!target) {
          target = { name: group.name, items: [] };
          byName.set(key, target);
          ordered.push(target);
        }
        for (const text of group.items) {
          const itemKey = text.toLowerCase();
          if (seen.has(itemKey)) continue;
          seen.add(itemKey);
          target.items.push({ id: uid(), text, checked: false });
        }
      }
    }
    return ordered.filter((g) => g.items.length > 0);
  }

  const countItems = (groups) => groups.reduce((n, g) => n + g.items.length, 0);
  const countChecked = (groups) => groups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  function seedState() {
    return {
      templates: SEED_TEMPLATES.map((t) => ({
        id: uid(),
        name: t.name,
        emoji: t.emoji,
        groups: parseGroups(t.text),
      })),
      packs: [],
    };
  }

  let isFreshSeed = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.templates) && Array.isArray(parsed.packs)) return parsed;
      }
    } catch (err) {
      console.warn('GoBag: could not read saved data, starting fresh.', err);
    }
    isFreshSeed = true;
    return seedState();
  }

  let state = loadState();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('GoBag: could not save.', err);
      toast('Out of storage — changes may not stick');
    }
  }


  const findTemplate = (id) => state.templates.find((t) => t.id === id);
  const findPack = (id) => state.packs.find((p) => p.id === id);

  /* ------------------------------------------------------------------ *
   * Chrome
   * ------------------------------------------------------------------ */

  const appEl = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  let toastTimer;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function go(hash) {
    location.hash = hash;
  }

  /* ------------------------------------------------------------------ *
   * Views
   * ------------------------------------------------------------------ */

  function viewPacks() {
    const packs = [...state.packs].sort((a, b) => b.createdAt - a.createdAt);

    const head = `
      <div class="page-head">
        <h2>Packs
          <span class="sub">Lists you're working through right now</span>
        </h2>
      </div>`;

    if (!packs.length) {
      return head + `
        <div class="empty">
          <div class="big">\u{1F9F3}</div>
          <p>No packs yet. Start one from a template and tick things off as they go in the bag.</p>
          <a class="btn btn-primary" href="#/new">Start a pack</a>
        </div>`;
    }

    const cards = packs.map((pack) => {
      const total = countItems(pack.groups);
      const done = countChecked(pack.groups);
      const complete = total > 0 && done === total;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `
        <div class="card">
          <button class="card-tap" data-action="open-pack" data-id="${pack.id}">
            <span class="card-emoji">${esc(pack.emoji || '\u{1F392}')}</span>
            <span class="card-body">
              <span class="card-title">${esc(pack.name)}</span>
              <span class="card-meta">${complete ? 'All packed \u{2713}' : `${done} of ${total} packed`}</span>
              <span class="progress${complete ? ' done' : ''}"><span style="width:${pct}%"></span></span>
            </span>
            ${CHEV_SVG}
          </button>
        </div>`;
    }).join('');

    return head + cards + `
      <div class="btn-row" style="margin-top:16px">
        <a class="btn btn-primary btn-block" href="#/new">Start a pack</a>
      </div>`;
  }

  function viewPackDetail(id) {
    const pack = findPack(id);
    if (!pack) return null;

    const total = countItems(pack.groups);
    const done = countChecked(pack.groups);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const complete = total > 0 && done === total;

    const groups = pack.groups.map((group) => `
      <section class="group">
        ${group.name ? `<h3 class="group-name">${esc(group.name)}</h3>` : ''}
        <div class="list">
          ${group.items.map((item) => `
            <div class="item${item.checked ? ' checked' : ''}" data-action="toggle-item"
                 data-pack="${pack.id}" data-item="${item.id}" role="button" tabindex="0"
                 aria-pressed="${item.checked}">
              <span class="box">${CHECK_SVG}</span>
              <span class="item-text">${esc(item.text)}</span>
              <button class="item-remove" data-action="remove-item" data-pack="${pack.id}"
                      data-item="${item.id}" title="Remove ${esc(item.text)}"
                      aria-label="Remove ${esc(item.text)}">&times;</button>
            </div>`).join('')}
        </div>
      </section>`).join('');

    return `
      <a class="back" href="#/packs">&larr; Packs</a>

      <div class="detail-head">
        <div class="detail-title">
          <span class="card-emoji">${esc(pack.emoji || '\u{1F392}')}</span>
          <div style="flex:1;min-width:0">
            <h2>${esc(pack.name)}</h2>
            <div class="count" id="pack-count">${complete ? 'All packed \u{2713}' : `${done} of ${total} packed`}</div>
          </div>
        </div>
        <div class="progress${complete ? ' done' : ''}" id="pack-progress"><span style="width:${pct}%"></span></div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-sm" data-action="reset-pack" data-id="${pack.id}">Unpack all</button>
          <button class="btn btn-sm" data-action="rename-pack" data-id="${pack.id}">Rename</button>
          <button class="btn btn-sm" data-action="pack-to-template" data-id="${pack.id}">Save as template</button>
          <button class="btn btn-sm btn-danger" data-action="delete-pack" data-id="${pack.id}">Delete</button>
        </div>
      </div>

      <div id="pack-groups">${groups || '<p class="hint">This pack is empty. Add something below.</p>'}</div>

      <form class="add-row" data-action="add-pack-item" data-id="${pack.id}">
        <input class="input" name="text" placeholder="Add an item…" autocomplete="off">
        <button class="btn btn-primary" type="submit">Add</button>
      </form>`;
  }

  function viewTemplates() {
    const head = `
      <div class="page-head">
        <h2>Templates
          <span class="sub">Reusable lists — start a pack from one any time</span>
        </h2>
      </div>`;

    if (!state.templates.length) {
      return head + `
        <div class="empty">
          <div class="big">\u{1F4CB}</div>
          <p>No templates yet.</p>
          <a class="btn btn-primary" href="#/template/new">New template</a>
        </div>`;
    }

    const cards = state.templates.map((template) => {
      const total = countItems(template.groups);
      const groupNames = template.groups.map((g) => g.name).filter(Boolean);
      const meta = groupNames.length
        ? `${plural(total, 'item')} · ${groupNames.slice(0, 3).join(', ')}${groupNames.length > 3 ? '…' : ''}`
        : plural(total, 'item');
      return `
        <div class="card">
          <button class="card-tap" data-action="edit-template" data-id="${template.id}">
            <span class="card-emoji">${esc(template.emoji || '\u{1F4CB}')}</span>
            <span class="card-body">
              <span class="card-title">${esc(template.name)}</span>
              <span class="card-meta">${esc(meta)}</span>
            </span>
            ${CHEV_SVG}
          </button>
          <div class="card-foot">
            <button class="btn btn-sm btn-primary" data-action="quick-pack" data-id="${template.id}">Start a pack</button>
            <button class="btn btn-sm btn-ghost" data-action="duplicate-template" data-id="${template.id}">Duplicate</button>
          </div>
        </div>`;
    }).join('');

    return head + cards + `
      <div class="btn-row" style="margin-top:16px">
        <a class="btn btn-block" href="#/template/new">New template</a>
      </div>`;
  }

  function viewTemplateEditor(id) {
    const isNew = id === 'new';
    const template = isNew ? null : findTemplate(id);
    if (!isNew && !template) return null;

    return `
      <a class="back" href="#/templates">&larr; Templates</a>

      <div class="page-head">
        <h2>${isNew ? 'New template' : 'Edit template'}</h2>
      </div>

      <form data-action="save-template" data-id="${isNew ? '' : template.id}">
        <div class="field">
          <label for="t-name">Name</label>
          <div class="field-row">
            <input class="input emoji-input" name="emoji" id="t-emoji" maxlength="4"
                   value="${esc(template ? template.emoji : '')}" placeholder="\u{1F4CB}" aria-label="Emoji">
            <input class="input" name="name" id="t-name" required placeholder="Swimming, Beach day…"
                   value="${esc(template ? template.name : '')}">
          </div>
        </div>

        <div class="field">
          <label for="t-items">Items</label>
          <textarea class="input" name="items" id="t-items"
                    placeholder="Towel&#10;Goggles&#10;&#10;# Toiletries&#10;Shampoo">${esc(template ? groupsToText(template.groups) : '')}</textarea>
          <p class="hint">One item per line. Start a line with <code>#</code> to begin a new section.</p>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" type="submit">${isNew ? 'Create template' : 'Save changes'}</button>
          ${isNew ? '' : `<button class="btn btn-danger" type="button" data-action="delete-template" data-id="${template.id}">Delete</button>`}
        </div>
      </form>`;
  }

  function viewNewPack() {
    if (!state.templates.length) {
      return `
        <a class="back" href="#/packs">&larr; Packs</a>
        <div class="empty">
          <div class="big">\u{1F4CB}</div>
          <p>You need a template first.</p>
          <a class="btn btn-primary" href="#/template/new">New template</a>
        </div>`;
    }

    const picks = state.templates.map((template) => `
      <button type="button" class="pick" data-action="toggle-pick" data-id="${template.id}" aria-pressed="false">
        <span class="card-emoji">${esc(template.emoji || '\u{1F4CB}')}</span>
        <span class="card-body">
          <span class="card-title">${esc(template.name)}</span>
          <span class="card-meta">${plural(countItems(template.groups), 'item')}</span>
        </span>
        <span class="box">${CHECK_SVG}</span>
      </button>`).join('');

    return `
      <a class="back" href="#/packs">&larr; Packs</a>

      <div class="page-head">
        <h2>Start a pack
          <span class="sub">Pick one or more templates — duplicates get merged</span>
        </h2>
      </div>

      <div class="list" id="pick-list">${picks}</div>

      <form data-action="create-pack" style="margin-top:18px">
        <div class="field">
          <label for="p-name">Pack name</label>
          <input class="input" name="name" id="p-name" placeholder="Named after the templates you pick" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Create pack</button>
      </form>`;
  }

  /* ------------------------------------------------------------------ *
   * Router
   * ------------------------------------------------------------------ */

  function render(keepScroll = false) {
    const hash = location.hash.replace(/^#\/?/, '');
    const [view, param] = hash.split('/');

    let html = null;
    let tab = 'packs';

    switch (view) {
      case 'templates':
        html = viewTemplates();
        tab = 'templates';
        break;
      case 'template':
        html = viewTemplateEditor(param);
        tab = 'templates';
        break;
      case 'pack':
        html = viewPackDetail(param);
        break;
      case 'new':
        html = viewNewPack();
        break;
      case 'packs':
      case '':
        html = viewPacks();
        break;
      default:
        html = null;
    }

    if (html === null) {
      go('#/packs');
      return;
    }

    appEl.innerHTML = html;
    for (const el of document.querySelectorAll('.tab')) {
      el.classList.toggle('active', el.dataset.tab === tab);
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }

  /** Re-render after an edit without yanking the user back to the top of a long list. */
  function rerender() {
    const y = window.scrollY;
    render(true);
    window.scrollTo(0, y);
  }

  window.addEventListener('hashchange', () => render());

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  function createPack(templateIds, name) {
    const templates = templateIds.map(findTemplate).filter(Boolean);
    if (!templates.length) return null;

    const pack = {
      id: uid(),
      name: name || templates.map((t) => t.name).join(' + '),
      emoji: templates[0].emoji,
      createdAt: Date.now(),
      groups: buildPackGroups(templates),
    };
    state.packs.push(pack);
    save();
    return pack;
  }

  /** Toggle in place rather than re-rendering, so scroll position survives. */
  function toggleItem(packId, itemId, row) {
    const pack = findPack(packId);
    if (!pack) return;

    let target = null;
    for (const group of pack.groups) {
      target = group.items.find((i) => i.id === itemId);
      if (target) break;
    }
    if (!target) return;

    target.checked = !target.checked;
    save();

    row.classList.toggle('checked', target.checked);
    row.setAttribute('aria-pressed', String(target.checked));

    const total = countItems(pack.groups);
    const done = countChecked(pack.groups);
    const complete = total > 0 && done === total;

    const countEl = document.getElementById('pack-count');
    const progressEl = document.getElementById('pack-progress');
    if (countEl) countEl.textContent = complete ? 'All packed ✓' : `${done} of ${total} packed`;
    if (progressEl) {
      progressEl.classList.toggle('done', complete);
      progressEl.firstElementChild.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
    }
    if (complete && target.checked) toast('All packed \u{1F389}');
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM') return;

    const { action, id } = el.dataset;

    switch (action) {
      case 'open-pack':
        go(`#/pack/${id}`);
        break;

      case 'edit-template':
        go(`#/template/${id}`);
        break;

      case 'toggle-item':
        toggleItem(el.dataset.pack, el.dataset.item, el);
        break;

      case 'remove-item': {
        const pack = findPack(el.dataset.pack);
        if (!pack) break;
        for (const group of pack.groups) {
          group.items = group.items.filter((i) => i.id !== el.dataset.item);
        }
        pack.groups = pack.groups.filter((g) => g.items.length > 0);
        save();
        rerender();
        break;
      }

      case 'reset-pack': {
        const pack = findPack(id);
        if (!pack) break;
        for (const group of pack.groups) {
          for (const item of group.items) item.checked = false;
        }
        save();
        rerender();
        toast('Unpacked — ready to reuse');
        break;
      }

      case 'rename-pack': {
        const pack = findPack(id);
        if (!pack) break;
        const name = prompt('Name this pack', pack.name);
        if (name && name.trim()) {
          pack.name = name.trim();
          save();
          render();
        }
        break;
      }

      case 'pack-to-template': {
        const pack = findPack(id);
        if (!pack) break;
        const name = prompt('Name the new template', pack.name);
        if (!name || !name.trim()) break;
        state.templates.push({
          id: uid(),
          name: name.trim(),
          emoji: pack.emoji,
          groups: pack.groups.map((g) => ({ name: g.name, items: g.items.map((i) => i.text) })),
        });
        save();
        toast('Saved to templates');
        break;
      }

      case 'delete-pack': {
        const pack = findPack(id);
        if (!pack) break;
        if (!confirm(`Delete "${pack.name}"? This can't be undone.`)) break;
        state.packs = state.packs.filter((p) => p.id !== id);
        save();
        go('#/packs');
        break;
      }

      case 'quick-pack': {
        const pack = createPack([id]);
        if (pack) go(`#/pack/${pack.id}`);
        break;
      }

      case 'duplicate-template': {
        const template = findTemplate(id);
        if (!template) break;
        state.templates.push({
          id: uid(),
          name: `${template.name} copy`,
          emoji: template.emoji,
          groups: template.groups.map((g) => ({ name: g.name, items: [...g.items] })),
        });
        save();
        render();
        toast('Duplicated');
        break;
      }

      case 'delete-template': {
        const template = findTemplate(id);
        if (!template) break;
        if (!confirm(`Delete the "${template.name}" template? Existing packs are not affected.`)) break;
        state.templates = state.templates.filter((t) => t.id !== id);
        save();
        go('#/templates');
        break;
      }

      case 'toggle-pick':
        el.classList.toggle('on');
        el.setAttribute('aria-pressed', String(el.classList.contains('on')));
        break;

      default:
        break;
    }
  });

  // Keyboard support for the checklist rows, which are divs so they can hold a remove button.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-action="toggle-item"]');
    if (!row) return;
    event.preventDefault();
    toggleItem(row.dataset.pack, row.dataset.item, row);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();

    const data = new FormData(form);
    const { action, id } = form.dataset;

    if (action === 'add-pack-item') {
      const text = String(data.get('text') || '').trim();
      if (!text) return;
      const pack = findPack(id);
      if (!pack) return;

      let extras = pack.groups.find((g) => g.name === 'Added');
      if (!extras) {
        extras = { name: 'Added', items: [] };
        pack.groups.push(extras);
      }
      extras.items.push({ id: uid(), text, checked: false });
      save();
      rerender();

      const input = document.querySelector('form[data-action="add-pack-item"] input[name="text"]');
      if (input) input.focus();
      return;
    }

    if (action === 'save-template') {
      const name = String(data.get('name') || '').trim();
      const emoji = String(data.get('emoji') || '').trim();
      const groups = parseGroups(String(data.get('items') || ''));

      if (!name) return;
      if (!groups.length) {
        toast('Add at least one item');
        return;
      }

      const existing = id ? findTemplate(id) : null;
      if (existing) {
        Object.assign(existing, { name, emoji, groups });
        toast('Saved');
      } else {
        state.templates.push({ id: uid(), name, emoji, groups });
        toast('Template created');
      }
      save();
      go('#/templates');
      return;
    }

    if (action === 'create-pack') {
      const picked = [...document.querySelectorAll('.pick.on')].map((el) => el.dataset.id);
      if (!picked.length) {
        toast('Pick at least one template');
        return;
      }
      const pack = createPack(picked, String(data.get('name') || '').trim());
      if (pack) go(`#/pack/${pack.id}`);
    }
  });

  /* ------------------------------------------------------------------ *
   * Install prompt + service worker
   * ------------------------------------------------------------------ */

  const installBtn = document.getElementById('install-btn');
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    toast('GoBag installed');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('GoBag: service worker registration failed.', err);
      });
    });
  }

  /* ------------------------------------------------------------------ */

  // Write the starter templates straight away so their ids stay stable across sessions.
  if (isFreshSeed) save();

  if (!location.hash) location.hash = '#/packs';
  render();
})();
