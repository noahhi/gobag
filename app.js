/* GoBag — reusable packing bags for trips and everyday outings.
 *
 * Vocabulary: a "bag" is a reusable packing list; a "go" is one outing —
 * a working copy of one or more bags that you tick off. Ticking off a go
 * never touches the bags it came from.
 */
(() => {
  'use strict';

  const STORE_KEY = 'gobag.v1';

  /* ------------------------------------------------------------------ *
   * Starter bags
   * ------------------------------------------------------------------ */

  const SEED_BAGS = [
    {
      name: 'Swimming',
      emoji: '\u{1F3CA}',
      text: `Swimsuit
Towel
Goggles
Glasses Case
Slides
Squeeze water bottle
Underwear + Shorts`,
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

  /** Merge one or more bags into go groups, de-duplicating repeated items. */
  function buildGoGroups(bags) {
    const byName = new Map();
    const ordered = [];
    const seen = new Set();

    for (const bag of bags) {
      for (const group of bag.groups) {
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
      bags: SEED_BAGS.map((b) => ({
        id: uid(),
        name: b.name,
        emoji: b.emoji,
        groups: parseGroups(b.text),
      })),
      gos: [],
    };
  }

  // Set when loadState produced something localStorage doesn't hold yet
  // (a fresh seed or a migrated schema), so init can persist it right away.
  let needsPersist = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate the original schema, which called bags "templates" and gos "packs".
        if (parsed && Array.isArray(parsed.templates)) {
          needsPersist = true;
          return { bags: parsed.templates, gos: Array.isArray(parsed.packs) ? parsed.packs : [] };
        }
        if (parsed && Array.isArray(parsed.bags) && Array.isArray(parsed.gos)) return parsed;
      }
    } catch (err) {
      console.warn('GoBag: could not read saved data, starting fresh.', err);
    }
    needsPersist = true;
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

  const findBag = (id) => state.bags.find((b) => b.id === id);
  const findGo = (id) => state.gos.find((g) => g.id === id);

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

  function viewGos() {
    const gos = [...state.gos].sort((a, b) => b.createdAt - a.createdAt);

    const head = `
      <div class="page-head">
        <h2>Gos
          <span class="sub">What you're packing right now</span>
        </h2>
      </div>`;

    if (!gos.length) {
      return head + `
        <div class="empty">
          <div class="big">\u{1F9F3}</div>
          <p>No gos yet. Grab a bag, tick things off, and get going.</p>
          <a class="btn btn-primary" href="#/new">Start a go</a>
        </div>`;
    }

    const cards = gos.map((outing) => {
      const total = countItems(outing.groups);
      const done = countChecked(outing.groups);
      const complete = total > 0 && done === total;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `
        <div class="card">
          <button class="card-tap" data-action="open-go" data-id="${outing.id}">
            <span class="card-emoji">${esc(outing.emoji || '\u{1F392}')}</span>
            <span class="card-body">
              <span class="card-title">${esc(outing.name)}</span>
              <span class="card-meta">${complete ? 'All packed \u{2713}' : `${done} of ${total} packed`}</span>
              <span class="progress${complete ? ' done' : ''}"><span style="width:${pct}%"></span></span>
            </span>
            ${CHEV_SVG}
          </button>
        </div>`;
    }).join('');

    return head + cards + `
      <div class="btn-row" style="margin-top:16px">
        <a class="btn btn-primary btn-block" href="#/new">Start a go</a>
      </div>`;
  }

  function viewGoDetail(id) {
    const outing = findGo(id);
    if (!outing) return null;

    const total = countItems(outing.groups);
    const done = countChecked(outing.groups);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const complete = total > 0 && done === total;

    const groups = outing.groups.map((group) => `
      <section class="group">
        ${group.name ? `<h3 class="group-name">${esc(group.name)}</h3>` : ''}
        <div class="list">
          ${group.items.map((item) => `
            <div class="item${item.checked ? ' checked' : ''}" data-action="toggle-item"
                 data-go="${outing.id}" data-item="${item.id}" role="button" tabindex="0"
                 aria-pressed="${item.checked}">
              <span class="box">${CHECK_SVG}</span>
              <span class="item-text">${esc(item.text)}</span>
              <button class="item-remove" data-action="remove-item" data-go="${outing.id}"
                      data-item="${item.id}" title="Remove ${esc(item.text)}"
                      aria-label="Remove ${esc(item.text)}">&times;</button>
            </div>`).join('')}
        </div>
      </section>`).join('');

    return `
      <a class="back" href="#/gos">&larr; Gos</a>

      <div class="detail-head">
        <div class="detail-title">
          <span class="card-emoji">${esc(outing.emoji || '\u{1F392}')}</span>
          <div style="flex:1;min-width:0">
            <h2>${esc(outing.name)}</h2>
            <div class="count" id="go-count">${complete ? 'All packed \u{2713}' : `${done} of ${total} packed`}</div>
          </div>
        </div>
        <div class="progress${complete ? ' done' : ''}" id="go-progress"><span style="width:${pct}%"></span></div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-sm" data-action="reset-go" data-id="${outing.id}">Unpack all</button>
          <button class="btn btn-sm" data-action="rename-go" data-id="${outing.id}">Rename</button>
          <button class="btn btn-sm" data-action="save-as-bag" data-id="${outing.id}">Save as bag</button>
          <button class="btn btn-sm btn-danger" data-action="delete-go" data-id="${outing.id}">Delete</button>
        </div>
      </div>

      <div id="go-groups">${groups || '<p class="hint">This go is empty. Add something below.</p>'}</div>

      <form class="add-row" data-action="add-go-item" data-id="${outing.id}">
        <input class="input" name="text" placeholder="Add an item…" autocomplete="off">
        <button class="btn btn-primary" type="submit">Add</button>
      </form>`;
  }

  function viewBags() {
    const head = `
      <div class="page-head">
        <h2>Bags
          <span class="sub">Reusable packing lists — start a go from one any time</span>
        </h2>
      </div>`;

    if (!state.bags.length) {
      return head + `
        <div class="empty">
          <div class="big">\u{1F392}</div>
          <p>No bags yet.</p>
          <a class="btn btn-primary" href="#/bag/new">New bag</a>
        </div>`;
    }

    const cards = state.bags.map((bag) => {
      const total = countItems(bag.groups);
      const groupNames = bag.groups.map((g) => g.name).filter(Boolean);
      const meta = groupNames.length
        ? `${plural(total, 'item')} · ${groupNames.slice(0, 3).join(', ')}${groupNames.length > 3 ? '…' : ''}`
        : plural(total, 'item');
      return `
        <div class="card">
          <button class="card-tap" data-action="edit-bag" data-id="${bag.id}">
            <span class="card-emoji">${esc(bag.emoji || '\u{1F392}')}</span>
            <span class="card-body">
              <span class="card-title">${esc(bag.name)}</span>
              <span class="card-meta">${esc(meta)}</span>
            </span>
            ${CHEV_SVG}
          </button>
          <div class="card-foot">
            <button class="btn btn-sm btn-primary" data-action="quick-go" data-id="${bag.id}">Start a go</button>
            <button class="btn btn-sm btn-ghost" data-action="duplicate-bag" data-id="${bag.id}">Duplicate</button>
          </div>
        </div>`;
    }).join('');

    return head + cards + `
      <div class="btn-row" style="margin-top:16px">
        <a class="btn btn-block" href="#/bag/new">New bag</a>
      </div>`;
  }

  function viewBagEditor(id) {
    const isNew = id === 'new';
    const bag = isNew ? null : findBag(id);
    if (!isNew && !bag) return null;

    return `
      <a class="back" href="#/bags">&larr; Bags</a>

      <div class="page-head">
        <h2>${isNew ? 'New bag' : 'Edit bag'}</h2>
      </div>

      <form data-action="save-bag" data-id="${isNew ? '' : bag.id}">
        <div class="field">
          <label for="b-name">Name</label>
          <div class="field-row">
            <input class="input emoji-input" name="emoji" id="b-emoji" maxlength="4"
                   value="${esc(bag ? bag.emoji : '')}" placeholder="\u{1F392}" aria-label="Emoji">
            <input class="input" name="name" id="b-name" required placeholder="Swimming, Beach day…"
                   value="${esc(bag ? bag.name : '')}">
          </div>
        </div>

        <div class="field">
          <label for="b-items">Items</label>
          <textarea class="input" name="items" id="b-items"
                    placeholder="Towel&#10;Goggles&#10;&#10;# Toiletries&#10;Shampoo">${esc(bag ? groupsToText(bag.groups) : '')}</textarea>
          <p class="hint">One item per line. Start a line with <code>#</code> to begin a new section.</p>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" type="submit">${isNew ? 'Create bag' : 'Save changes'}</button>
          ${isNew ? '' : `<button class="btn btn-danger" type="button" data-action="delete-bag" data-id="${bag.id}">Delete</button>`}
        </div>
      </form>`;
  }

  function viewNewGo() {
    if (!state.bags.length) {
      return `
        <a class="back" href="#/gos">&larr; Gos</a>
        <div class="empty">
          <div class="big">\u{1F392}</div>
          <p>You need a bag first.</p>
          <a class="btn btn-primary" href="#/bag/new">New bag</a>
        </div>`;
    }

    const picks = state.bags.map((bag) => `
      <button type="button" class="pick" data-action="toggle-pick" data-id="${bag.id}" aria-pressed="false">
        <span class="card-emoji">${esc(bag.emoji || '\u{1F392}')}</span>
        <span class="card-body">
          <span class="card-title">${esc(bag.name)}</span>
          <span class="card-meta">${plural(countItems(bag.groups), 'item')}</span>
        </span>
        <span class="box">${CHECK_SVG}</span>
      </button>`).join('');

    return `
      <a class="back" href="#/gos">&larr; Gos</a>

      <div class="page-head">
        <h2>Start a go
          <span class="sub">Pick one or more bags — duplicates get merged</span>
        </h2>
      </div>

      <div class="list" id="pick-list">${picks}</div>

      <form data-action="create-go" style="margin-top:18px">
        <div class="field">
          <label for="g-name">Go name</label>
          <input class="input" name="name" id="g-name" placeholder="Named after the bags you pick" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Start the go</button>
      </form>`;
  }

  /* ------------------------------------------------------------------ *
   * Router
   * ------------------------------------------------------------------ */

  function render(keepScroll = false) {
    const hash = location.hash.replace(/^#\/?/, '');
    const [view, param] = hash.split('/');

    let html = null;
    let tab = 'gos';

    switch (view) {
      case 'bags':
        html = viewBags();
        tab = 'bags';
        break;
      case 'bag':
        html = viewBagEditor(param);
        tab = 'bags';
        break;
      case 'go':
        html = viewGoDetail(param);
        break;
      case 'new':
        html = viewNewGo();
        break;
      case 'gos':
      case '':
        html = viewGos();
        break;
      // Routes from before the rename, in case of stale bookmarks.
      case 'packs':
        go('#/gos');
        return;
      case 'templates':
        go('#/bags');
        return;
      default:
        html = null;
    }

    if (html === null) {
      go('#/gos');
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

  function createGo(bagIds, name) {
    const bags = bagIds.map(findBag).filter(Boolean);
    if (!bags.length) return null;

    const outing = {
      id: uid(),
      name: name || bags.map((b) => b.name).join(' + '),
      emoji: bags[0].emoji,
      createdAt: Date.now(),
      groups: buildGoGroups(bags),
    };
    state.gos.push(outing);
    save();
    return outing;
  }

  /** Toggle in place rather than re-rendering, so scroll position survives. */
  function toggleItem(goId, itemId, row) {
    const outing = findGo(goId);
    if (!outing) return;

    let target = null;
    for (const group of outing.groups) {
      target = group.items.find((i) => i.id === itemId);
      if (target) break;
    }
    if (!target) return;

    target.checked = !target.checked;
    save();

    row.classList.toggle('checked', target.checked);
    row.setAttribute('aria-pressed', String(target.checked));

    const total = countItems(outing.groups);
    const done = countChecked(outing.groups);
    const complete = total > 0 && done === total;

    const countEl = document.getElementById('go-count');
    const progressEl = document.getElementById('go-progress');
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
      case 'open-go':
        go(`#/go/${id}`);
        break;

      case 'edit-bag':
        go(`#/bag/${id}`);
        break;

      case 'toggle-item':
        toggleItem(el.dataset.go, el.dataset.item, el);
        break;

      case 'remove-item': {
        const outing = findGo(el.dataset.go);
        if (!outing) break;
        for (const group of outing.groups) {
          group.items = group.items.filter((i) => i.id !== el.dataset.item);
        }
        outing.groups = outing.groups.filter((g) => g.items.length > 0);
        save();
        rerender();
        break;
      }

      case 'reset-go': {
        const outing = findGo(id);
        if (!outing) break;
        for (const group of outing.groups) {
          for (const item of group.items) item.checked = false;
        }
        save();
        rerender();
        toast('Unpacked — ready for the next go');
        break;
      }

      case 'rename-go': {
        const outing = findGo(id);
        if (!outing) break;
        const name = prompt('Name this go', outing.name);
        if (name && name.trim()) {
          outing.name = name.trim();
          save();
          render();
        }
        break;
      }

      case 'save-as-bag': {
        const outing = findGo(id);
        if (!outing) break;
        const name = prompt('Name the new bag', outing.name);
        if (!name || !name.trim()) break;
        state.bags.push({
          id: uid(),
          name: name.trim(),
          emoji: outing.emoji,
          groups: outing.groups.map((g) => ({ name: g.name, items: g.items.map((i) => i.text) })),
        });
        save();
        toast('Saved to bags');
        break;
      }

      case 'delete-go': {
        const outing = findGo(id);
        if (!outing) break;
        if (!confirm(`Delete "${outing.name}"? This can't be undone.`)) break;
        state.gos = state.gos.filter((g) => g.id !== id);
        save();
        go('#/gos');
        break;
      }

      case 'quick-go': {
        const outing = createGo([id]);
        if (outing) go(`#/go/${outing.id}`);
        break;
      }

      case 'duplicate-bag': {
        const bag = findBag(id);
        if (!bag) break;
        state.bags.push({
          id: uid(),
          name: `${bag.name} copy`,
          emoji: bag.emoji,
          groups: bag.groups.map((g) => ({ name: g.name, items: [...g.items] })),
        });
        save();
        render();
        toast('Duplicated');
        break;
      }

      case 'delete-bag': {
        const bag = findBag(id);
        if (!bag) break;
        if (!confirm(`Delete the "${bag.name}" bag? Existing gos are not affected.`)) break;
        state.bags = state.bags.filter((b) => b.id !== id);
        save();
        go('#/bags');
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
    toggleItem(row.dataset.go, row.dataset.item, row);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();

    const data = new FormData(form);
    const { action, id } = form.dataset;

    if (action === 'add-go-item') {
      const text = String(data.get('text') || '').trim();
      if (!text) return;
      const outing = findGo(id);
      if (!outing) return;

      let extras = outing.groups.find((g) => g.name === 'Added');
      if (!extras) {
        extras = { name: 'Added', items: [] };
        outing.groups.push(extras);
      }
      extras.items.push({ id: uid(), text, checked: false });
      save();
      rerender();

      const input = document.querySelector('form[data-action="add-go-item"] input[name="text"]');
      if (input) input.focus();
      return;
    }

    if (action === 'save-bag') {
      const name = String(data.get('name') || '').trim();
      const emoji = String(data.get('emoji') || '').trim();
      const groups = parseGroups(String(data.get('items') || ''));

      if (!name) return;
      if (!groups.length) {
        toast('Add at least one item');
        return;
      }

      const existing = id ? findBag(id) : null;
      if (existing) {
        Object.assign(existing, { name, emoji, groups });
        toast('Saved');
      } else {
        state.bags.push({ id: uid(), name, emoji, groups });
        toast('Bag created');
      }
      save();
      go('#/bags');
      return;
    }

    if (action === 'create-go') {
      const picked = [...document.querySelectorAll('.pick.on')].map((el) => el.dataset.id);
      if (!picked.length) {
        toast('Pick at least one bag');
        return;
      }
      const outing = createGo(picked, String(data.get('name') || '').trim());
      if (outing) go(`#/go/${outing.id}`);
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

  if (needsPersist) save();

  if (!location.hash) location.hash = '#/gos';
  render();
})();
