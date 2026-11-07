import { DEMO, initBackend, authApi, watchUser, store, share } from './db.js';

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => BRL.format(v || 0);
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const sum = (arr, f = (x) => x.amount) => round2(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const ymOf = (iso) => iso.slice(0, 7);
const addMonths = (ym, n) => {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };
const monthName = (ym) => MONTHS[Number(ym.split('-')[1]) - 1];
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const parseNum = (s) => {
  s = String(s ?? '').trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
};

/** Mês de referência (mês da fatura) de uma compra. */
function refMonth(dateISO, acc) {
  const ym = ymOf(dateISO);
  if (!acc || acc.type !== 'credit') return ym;
  const d = Number(dateISO.slice(8, 10));
  const close = Number(acc.closingDay) || 1;
  const due = Number(acc.dueDay) || 10;
  const closeYm = d >= close ? addMonths(ym, 1) : ym; // em que mês essa fatura fecha
  return due > close ? closeYm : addMonths(closeYm, 1); // em que mês ela vence
}

/* =========================================================
   Padrões (tirados da sua planilha — dá pra editar tudo no app)
   ========================================================= */
const DEFAULT_SETTINGS = {
  appName: 'Meu Bolso',
  categories: [
    { id: 'contas', name: 'Contas', icon: '🧾', color: '#e88a8a' },
    { id: 'cosmeticos', name: 'Cosméticos', icon: '💄', color: '#f0a36b' },
    { id: 'educacao', name: 'Educação', icon: '📚', color: '#e8c75a' },
    { id: 'lazer', name: 'Lazer', icon: '🎉', color: '#8fcf7a' },
    { id: 'mercado', name: 'Mercado', icon: '🛒', color: '#6fb3e0' },
    { id: 'outros', name: 'Outros', icon: '📦', color: '#8aa9b8' },
    { id: 'lanche', name: 'Lanche', icon: '🍔', color: '#b39ddb' },
    { id: 'jogos', name: 'Jogos', icon: '🎮', color: '#e57373' },
    { id: 'restaurante', name: 'Restaurante', icon: '🍽️', color: '#ff9f6e' },
    { id: 'saude', name: 'Saúde', icon: '💊', color: '#f2d16b' },
    { id: 'transporte', name: 'Transporte', icon: '🚗', color: '#7cc47f' },
    { id: 'casa', name: 'Compras casa', icon: '🏠', color: '#64b5f6' },
    { id: 'vestuario', name: 'Vestuário', icon: '👕', color: '#80a4b0' },
    { id: 'viagem', name: 'Viagem', icon: '✈️', color: '#c5a3e0' }
  ],
  accounts: [
    { id: 'xp', name: 'Cartão XP', type: 'credit', closingDay: 1, dueDay: 10, color: '#e88a8a' },
    { id: 'nubank', name: 'Nubank', type: 'credit', closingDay: 1, dueDay: 10, color: '#a78bfa' },
    { id: 'debito', name: 'Débito / Pix', type: 'debit', color: '#6ec59a' }
  ],
  incomes: [
    { id: 'r1', name: 'Fonte de Renda 1', amount: 1577 },
    { id: 'r2', name: 'Fonte de Renda 2', amount: 1992 },
    { id: 'r3', name: 'Fonte de Renda 3', amount: 400 }
  ]
};
const DEFAULT_RECURRING = [
  ['Crunchyroll', 20, 'contas'], ['WoW', 40, 'jogos'], ['Spotify', 23.9, 'contas'], ['Celular Pih', 162, 'contas'],
  ['Twitch Turbo', 25, 'contas'], ['Gamepass', 76, 'jogos'], ['Clube iFood', 8, 'lanche']
].map(([desc, amount, cat], i) => ({ id: 'fx' + i, desc, amount, cat, startMonth: '2020-01', endMonth: null, createdAt: Date.now() + i }));

/* =========================================================
   Estado
   ========================================================= */
const S = { sheet: null, invite: null, user: undefined, tx: [], rec: [], settings: null, view: 'home', month: ymOf(todayISO()), monthSet: false, filter: 'all', search: '' };
let unwatch = null, seeding = false, lostOnce = false;

const cats = () => S.settings.categories;
const lastAcc = () => { try { return localStorage.getItem('mb-last-acc'); } catch (e) { return null; } };
const myName = () => (S.user && (S.user.name || (S.user.email || '').split('@')[0])) || 'Eu';
const isShared = () => !!(S.sheet && (S.sheet.members || []).length > 1);
const nameOf = (uid) => (S.sheet && S.sheet.names && S.sheet.names[uid]) || 'alguém';
const byLabel = (t) => (isShared() && t.by ? ' · ' + (t.by === S.user.uid ? 'você' : nameOf(t.by)) : '');
const accs = () => S.settings.accounts;
const catById = (id) => cats().find((c) => c.id === id) || { id, name: 'Sem categoria', icon: '•', color: '#999' };
const accById = (id) => accs().find((a) => a.id === id) || null;
const activeRec = (ym) => S.rec.filter((r) => (r.startMonth || '0000') <= ym && (!r.endMonth || ym <= r.endMonth));

function monthData(ym) {
  const tx = S.tx.filter((t) => t.month === ym);
  const exp = tx.filter((t) => t.kind !== 'income');
  const inc = tx.filter((t) => t.kind === 'income');
  const fixed = activeRec(ym).map((r) => ({ ...r, fixed: true }));
  const incomeBase = sum(S.settings.incomes);
  const income = round2(incomeBase + sum(inc));
  const all = [...fixed, ...exp];
  const spent = sum(all);
  const byAcc = { fixos: sum(fixed) };
  accs().forEach((a) => (byAcc[a.id] = sum(exp.filter((t) => t.acc === a.id))));
  const byCat = {};
  all.forEach((t) => (byCat[t.cat] = round2((byCat[t.cat] || 0) + t.amount)));
  return { tx, exp, inc, fixed, income, incomeBase, spent, left: round2(income - spent), byAcc, byCat };
}

/* =========================================================
   Tema
   ========================================================= */
const THEME_COLORS = { dark: '#262624', pih: '#efcdee' };
function applyTheme(t) {
  if (!THEME_COLORS[t]) t = 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('mb-theme', t); } catch (e) {}
  const m = $('meta[name="theme-color"]'); if (m) m.content = THEME_COLORS[t];
}
function setTheme(t) {
  applyTheme(t);
  store.saveProfile({ theme: t }).catch(() => {});
  render();
}
function makeDots() {
  const box = $('.bg-dots'); if (!box || box.childElementCount) return;
  for (let i = 0; i < 22; i++) {
    const d = document.createElement('i');
    const s = 2 + Math.random() * 5;
    d.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-delay:${-Math.random() * 20}s;animation-duration:${14 + Math.random() * 16}s;opacity:${0.35 + Math.random() * 0.5}`;
    box.appendChild(d);
  }
}

/* =========================================================
   Persistência
   ========================================================= */
function onWriteError(e) {
  console.error(e);
  const msg = e && e.code === 'permission-denied'
    ? 'Sem permissão no banco. Confira as Regras do Firestore (passo 3 do guia).'
    : 'Não consegui salvar: ' + (e && e.message ? e.message : e);
  toast(msg, true);
}
function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch };
  store.saveSettings(S.settings).catch(onWriteError);
  render();
}

/* =========================================================
   Ícones
   ========================================================= */
const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
};

/* =========================================================
   Render principal
   ========================================================= */
function render() {
  const app = $('#app');
  if (S.user === undefined) { app.innerHTML = '<div class="center-screen"><div class="spinner"></div></div>'; return; }
  if (!S.user) { app.innerHTML = loginHTML(); bindLogin(); return; }
  if (!S.settings) { app.innerHTML = '<div class="center-screen"><div class="spinner"></div><p class="muted">carregando seus dados…</p></div>'; return; }
  const body = S.view === 'list' ? listHTML() : S.view === 'settings' ? settingsHTML() : homeHTML();
  app.innerHTML = `
    <div class="layout">
      ${navHTML()}
      <main class="container view-${S.view}">${body}</main>
    </div>
    <button class="fab" data-act="add" aria-label="Novo lançamento">${ICON.plus}</button>`;
}

function navHTML() {
  const item = (v, ic, label) => `<button class="nav-item ${S.view === v ? 'on' : ''}" data-act="view" data-v="${v}">${ICON[ic]}<span>${label}</span></button>`;
  return `<nav class="nav">
    <div class="nav-brand">${esc(S.settings.appName)} <span class="heart">♡</span></div>
    ${item('home', 'home', 'Início')}${item('list', 'list', 'Lançamentos')}${item('settings', 'gear', 'Ajustes')}
    <button class="nav-add btn primary" data-act="add">${ICON.plus}<span>Novo lançamento</span></button>
  </nav>`;
}

function headerHTML(title, sub) {
  return `<header class="topbar"><div><h1 class="title">${title}</h1>${sub ? `<p class="subtitle">${sub}</p>` : ''}</div>
    ${DEMO ? '<span class="tag">demo</span>' : ''}</header>`;
}

function monthSwitchHTML() {
  return `<div class="month-switch">
    <button class="icon-btn" data-act="prev" aria-label="Mês anterior">${ICON.left}</button>
    <div class="month-label"><strong>${monthLabel(S.month)}</strong><small>faturas que vencem em ${monthName(S.month)}</small></div>
    <button class="icon-btn" data-act="next" aria-label="Próximo mês">${ICON.right}</button>
  </div>`;
}

function txRowHTML(t) {
  const c = catById(t.cat);
  const income = t.kind === 'income';
  const meta = (t.fixed ? 'Gasto fixo' : income ? 'Entrada' : (accById(t.acc)?.name || '—')) + byLabel(t);
  return `<button class="tx" data-act="edit" data-id="${esc(t.id)}" data-type="${t.fixed ? 'rec' : 'tx'}">
    <span class="cat-ico" style="--c:${income ? 'var(--good)' : c.color}">${income ? '↓' : esc(c.icon)}</span>
    <span class="tx-main">
      <span class="tx-desc">${esc(t.desc)}${t.inst ? ` <em class="inst">${t.inst.i}/${t.inst.n}</em>` : ''}</span>
      <span class="tx-meta">${income ? '' : esc(c.name) + ' · '}${esc(meta)}${t.date && !t.fixed ? ' · ' + ddmm(t.date) : ''}</span>
    </span>
    <span class="tx-amt ${income ? 'pos' : ''}">${income ? '+' : ''}${money(t.amount)}</span>
  </button>`;
}

/* ---------------- Início ---------------- */
function homeHTML() {
  const d = monthData(S.month);
  const pct = d.income > 0 ? Math.min(100, (d.spent / d.income) * 100) : d.spent > 0 ? 100 : 0;
  const tiles = [{ id: 'fixos', name: 'Gastos fixos', color: 'var(--muted)' }, ...accs()]
    .map((a) => `<button class="acc-tile" data-act="goacc" data-acc="${a.id}">
      <span class="dot" style="--c:${a.color}"></span><span class="acc-name">${esc(a.name)}</span>
      <b>${money(d.byAcc[a.id])}</b></button>`).join('');

  const catRows = cats()
    .map((c) => ({ c, spent: d.byCat[c.id] || 0 }))
    .filter((x) => x.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const maxSpent = Math.max(1, ...catRows.map((x) => x.spent));
  const catHTML = catRows.map(({ c, spent }) => {
    const share = d.spent > 0 ? Math.round((spent / d.spent) * 100) : 0;
    return `<div class="cat-row">
      <span class="cat-ico" style="--c:${c.color}">${esc(c.icon)}</span>
      <div class="cat-main">
        <div class="cat-top"><span>${esc(c.name)}</span><span><b>${money(spent)}</b><small> · ${share}%</small></span></div>
        <div class="bar small"><i style="width:${(spent / maxSpent) * 100}%;background:${c.color}"></i></div>
      </div></div>`;
  }).join('') || '<p class="muted empty">Nada por aqui ainda.</p>';

  const recent = [...d.exp, ...d.inc].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const nextInst = sum(S.tx.filter((t) => t.month === addMonths(S.month, 1) && t.inst));

  return `
    ${headerHTML(`${esc(S.settings.appName)} <span class="heart">♡</span>`, 'um respiro pro bolso')}
    ${monthSwitchHTML()}
    <div class="home-grid">
      <section class="card hero">
        <span class="label">Sobrando</span>
        <div class="big ${d.left < 0 ? 'neg' : ''}">${money(d.left)}</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="hero-row">
          <div><span class="label">Rendas</span><b>${money(d.income)}</b></div>
          <div><span class="label">Gastos</span><b>${money(d.spent)}</b></div>
        </div>
        ${nextInst > 0 ? `<p class="hint">Parcelas já lançadas para ${monthName(addMonths(S.month, 1))}: <b>${money(nextInst)}</b></p>` : ''}
      </section>
      <section class="acc-grid">${tiles}</section>
      <section class="card cats">
        <h2>Gastos por categoria</h2>
        ${catHTML}
      </section>
      <section class="card recent">
        <div class="card-head"><h2>Últimos lançamentos</h2><button class="link" data-act="view" data-v="list">ver todos</button></div>
        ${recent.length ? `<div class="tx-list">${recent.map(txRowHTML).join('')}</div>` : `<p class="muted empty">Toque no <b>+</b> para lançar seu primeiro gasto.</p>`}
      </section>
    </div>`;
}

/* ---------------- Lançamentos ---------------- */
function filteredItems() {
  const d = monthData(S.month);
  let items;
  if (S.filter === 'fixos') items = d.fixed;
  else if (S.filter === 'income') items = d.inc;
  else if (S.filter === 'all') items = [...d.fixed, ...d.exp, ...d.inc];
  else items = d.exp.filter((t) => t.acc === S.filter);
  const q = S.search.trim().toLowerCase();
  if (q) items = items.filter((t) => (t.desc || '').toLowerCase().includes(q) || catById(t.cat).name.toLowerCase().includes(q));
  return items;
}
function listBodyHTML() {
  const items = filteredItems();
  if (!items.length) return '<p class="muted empty">Nenhum lançamento encontrado.</p>';
  const fixed = items.filter((t) => t.fixed);
  const rest = items.filter((t) => !t.fixed).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const groups = {};
  rest.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
  const expTotal = sum(items.filter((t) => t.kind !== 'income'));
  let html = `<p class="list-total">${items.length} lançamento${items.length > 1 ? 's' : ''} · <b>${money(expTotal)}</b> em gastos</p>`;
  if (fixed.length) html += `<div class="group"><h3>Gastos fixos <span>${money(sum(fixed))}</span></h3><div class="card tx-list">${fixed.map(txRowHTML).join('')}</div></div>`;
  Object.keys(groups).forEach((date) => {
    const dt = new Date(date + 'T12:00:00');
    const label = cap(dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
    html += `<div class="group"><h3>${esc(label)} <span>${money(sum(groups[date].filter((t) => t.kind !== 'income')))}</span></h3><div class="card tx-list">${groups[date].map(txRowHTML).join('')}</div></div>`;
  });
  return html;
}
function listHTML() {
  const chip = (v, label) => `<button class="chip ${S.filter === v ? 'on' : ''}" data-act="filter" data-f="${v}">${esc(label)}</button>`;
  return `
    ${headerHTML('Lançamentos', '')}
    ${monthSwitchHTML()}
    <label class="search">${ICON.search}<input id="search" type="search" placeholder="Buscar descrição ou categoria" value="${esc(S.search)}"></label>
    <div class="chips scroll">${chip('all', 'Todos')}${chip('fixos', 'Fixos')}${accs().map((a) => chip(a.id, a.name)).join('')}${chip('income', 'Entradas')}</div>
    <div id="list-body">${listBodyHTML()}</div>`;
}

/* ---------------- Ajustes ---------------- */
function settingsHTML() {
  const t = document.documentElement.dataset.theme;
  const row = (act, id, left, right, sub = '') => `<button class="set-row" data-act="${act}" data-id="${esc(id)}">
    <span class="set-left">${left}${sub ? `<small>${sub}</small>` : ''}</span><span class="set-right">${right}</span></button>`;
  const recs = [...S.rec].sort((a, b) => (a.endMonth ? 1 : 0) - (b.endMonth ? 1 : 0) || (a.createdAt || 0) - (b.createdAt || 0));
  return `
    ${headerHTML('Ajustes', DEMO ? 'modo demonstração — os dados ficam só neste navegador' : esc(S.user.email || ''))}
    <div class="settings-grid">
    <section class="card">
      <h2>Aparência</h2>
      <div class="seg">
        <button class="${t === 'dark' ? 'on' : ''}" data-act="theme" data-t="dark">Escuro</button>
        <button class="${t === 'pih' ? 'on' : ''}" data-act="theme" data-t="pih">Pih ♡</button>
      </div>
    </section>
    ${shareHTML()}
    <section class="card">
      <div class="card-head"><h2>Rendas mensais</h2><b>${money(sum(S.settings.incomes))}</b></div>
      ${S.settings.incomes.map((r) => row('editIncome', r.id, esc(r.name), money(r.amount))).join('')}
      <button class="btn ghost small" data-act="addIncome">+ Adicionar renda</button>
      <p class="hint">Rendas extras de um mês só: use “Entrada” no botão +.</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>Gastos fixos</h2><b>${money(sum(activeRec(S.month)))}</b></div>
      ${recs.map((r) => row('editRec', r.id, `${esc(catById(r.cat).icon)} ${esc(r.desc)}`, money(r.amount), r.endMonth ? `encerrado em ${monthLabel(r.endMonth)}` : '')).join('') || '<p class="muted">Nenhum.</p>'}
      <button class="btn ghost small" data-act="addRec">+ Adicionar gasto fixo</button>
    </section>
    <section class="card">
      <h2>Categorias</h2>
      ${cats().map((c) => row('editCat', c.id, `<span class="cat-ico sm" style="--c:${c.color}">${esc(c.icon)}</span> ${esc(c.name)}`, money(monthData(S.month).byCat[c.id] || 0))).join('')}
      <button class="btn ghost small" data-act="addCat">+ Nova categoria</button>
    </section>
    <section class="card">
      <h2>Contas e cartões</h2>
      ${accs().map((a) => row('editAcc', a.id, `<span class="dot" style="--c:${a.color}"></span> ${esc(a.name)}`, a.type === 'credit' ? `fecha dia ${a.closingDay} · vence dia ${a.dueDay}` : 'débito / pix')).join('')}
      <button class="btn ghost small" data-act="addAcc">+ Nova conta ou cartão</button>
    </section>
    <section class="card">
      <h2>Dados</h2>
      <button class="btn ghost small" data-act="exportCsv">Exportar ${monthName(S.month)} (planilha CSV)</button>
      <button class="btn ghost small" data-act="backup">Baixar backup completo</button>
      <button class="btn ghost small" data-act="restore">Restaurar backup</button>
      <input type="file" id="restore-file" accept="application/json" hidden>
    </section>
    <section class="card">
      <h2>Conta</h2>
      <p class="muted">${DEMO ? 'Para sincronizar entre celular e computador, siga o guia LEIA-ME e preencha o arquivo firebase-config.js.' : 'Conectado como ' + esc(S.user.email || S.user.name || '')}</p>
      <button class="btn ghost small" data-act="rename">Mudar nome do app</button>
      ${DEMO ? '' : '<button class="btn ghost small danger" data-act="logout">Sair</button>'}
    </section>
    </div>
    <p class="hint center">Meu Bolso · v1.0</p>`;
}

function shareHTML() {
  if (DEMO) return `<section class="card"><h2>Compartilhar planilha</h2><p class="muted">Disponível depois de configurar o Firebase.</p></section>`;
  const sh = S.sheet || { members: [], names: {} };
  const members = (sh.members || []).map((u) => `<div class="set-row static">
      <span class="set-left">${esc(u === S.user.uid ? (sh.names?.[u] || myName()) + ' (você)' : nameOf(u))}</span>
      <span class="set-right">${u === S.user.uid ? '<button class="link" data-act="myName">mudar nome</button>' : `<button class="link danger-link" data-act="removeMember" data-id="${esc(u)}">remover</button>`}</span>
    </div>`).join('');
  return `<section class="card">
      <h2>Compartilhar planilha</h2>
      <p class="muted small-p">Mande o link para quem vai usar junto. A pessoa entra com o login dela e passa a ver e lançar nesta mesma planilha.</p>
      ${members}
      <button class="btn primary small" data-act="invite">Copiar link de convite</button>
      <label class="check"><input type="checkbox" id="invite-open" ${sh.inviteOpen ? 'checked' : ''}> Aceitar novas pessoas pelo link</label>
      ${isShared() ? '<button class="btn ghost small danger" data-act="leaveSheet">Sair desta planilha</button>' : ''}
    </section>`;
}

/* ---------------- Convite ---------------- */
const inviteLink = () => location.origin + location.pathname + '?convite=' + encodeURIComponent(share.sheetId);
async function sendInvite() {
  const url = inviteLink();
  const text = 'Entra na nossa planilha do Meu Bolso ♡';
  try {
    if (navigator.share) { await navigator.share({ title: 'Meu Bolso', text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copiado ♡ Manda pra ele!'); }
  catch (e) { openForm({ title: 'Link de convite', fields: [{ key: 'link', label: 'Copie este link' }], values: { link: url }, onSave: () => {} }); }
}
function readInvite() {
  const q = new URLSearchParams(location.search).get('convite');
  if (q) {
    try { sessionStorage.setItem('mb-invite', q); } catch (e) {}
    history.replaceState(null, '', location.pathname);
  }
  try { return q || sessionStorage.getItem('mb-invite'); } catch (e) { return q; }
}
function clearInvite() { S.invite = null; try { sessionStorage.removeItem('mb-invite'); } catch (e) {} }
const JOIN_ERR = 'Convite inválido ou fechado. Peça um link novo para quem te convidou.';
async function maybeJoin() {
  if (!S.invite || !S.sheet || !S.settings) return;
  const inv = S.invite;
  if (inv === share.sheetId) { clearInvite(); return; }
  clearInvite();
  const ok = await choose('Entrar na planilha compartilhada?',
    'Você vai ver e lançar gastos na mesma planilha de quem te convidou. O que já está nesta conta fica guardado à parte.',
    [{ label: 'Entrar', value: true, cls: 'primary' }]);
  if (!ok) return;
  try { await share.join(inv, myName()); toast('Agora vocês estão na mesma planilha ♡'); }
  catch (e) { console.error(e); toast(JOIN_ERR, true); }
}

/* ---------------- Login ---------------- */
function loginHTML() {
  return `<main class="container login">
    <div class="card login-card">
      <h1 class="title">Meu Bolso <span class="heart">♡</span></h1>
      <p class="subtitle">entre para sincronizar celular e computador</p>
      <form id="login-form" class="stack">
        <input class="input" type="email" id="l-email" placeholder="E-mail" autocomplete="email" required>
        <input class="input" type="password" id="l-pass" placeholder="Senha (mínimo 6 caracteres)" autocomplete="current-password" required minlength="6">
        <button class="btn primary" type="submit">Entrar</button>
        <button class="btn ghost" type="button" id="l-signup">Criar conta</button>
      </form>
      <div class="or"><span>ou</span></div>
      <button class="btn ghost" id="l-google">Entrar com Google</button>
      <button class="link center-block" id="l-reset">Esqueci minha senha</button>
      <p id="l-err" class="err" role="alert"></p>
    </div></main>`;
}
const AUTH_ERR = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/user-not-found': 'Não existe conta com esse e-mail. Toque em “Criar conta”.',
  'auth/email-already-in-use': 'Esse e-mail já tem conta. Toque em “Entrar”.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (passo 6 do guia).',
  'auth/operation-not-allowed': 'Esse tipo de login não foi ativado no Firebase (passo 2 do guia).',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/network-request-failed': 'Sem internet. Tente de novo.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco.'
};
function bindLogin() {
  const err = (e) => ($('#l-err').textContent = AUTH_ERR[e.code] || e.message || String(e));
  const vals = () => [$('#l-email').value.trim(), $('#l-pass').value];
  $('#login-form').onsubmit = (ev) => { ev.preventDefault(); authApi.login(...vals()).catch(err); };
  $('#l-signup').onclick = () => { const f = $('#login-form'); if (!f.reportValidity()) return; authApi.signup(...vals()).catch(err); };
  $('#l-google').onclick = () => authApi.google().catch(err);
  $('#l-reset').onclick = () => {
    const e = $('#l-email').value.trim();
    if (!e) return ($('#l-err').textContent = 'Digite seu e-mail acima primeiro.');
    authApi.reset(e).then(() => ($('#l-err').textContent = 'Enviamos um link de redefinição para ' + e)).catch(err);
  };
}

/* =========================================================
   Folhas (bottom sheets) e diálogos
   ========================================================= */
let dialogResolve = null;
function openSheet(html, { root = '#sheet-root', onClose } = {}) {
  const r = $(root);
  r.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${html}</div>`;
  r.classList.add('open');
  document.body.classList.add('no-scroll');
  const close = () => closeSheet(root, onClose);
  $('.sheet-backdrop', r).onclick = close;
  $$('[data-close]', r).forEach((b) => (b.onclick = close));
  return $('.sheet', r);
}
function closeSheet(root = '#sheet-root', onClose) {
  const r = $(root);
  r.classList.remove('open'); r.innerHTML = '';
  if (!$('#sheet-root').classList.contains('open') && !$('#dialog-root').classList.contains('open')) document.body.classList.remove('no-scroll');
  onClose && onClose();
}
function choose(title, msg, buttons) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    const sheet = openSheet(`<div class="dialog"><h3>${esc(title)}</h3>${msg ? `<p class="muted">${esc(msg)}</p>` : ''}
      <div class="stack">${buttons.map((b, i) => `<button class="btn ${b.cls || 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join('')}
      <button class="btn ghost" data-close>Cancelar</button></div></div>`,
      { root: '#dialog-root', onClose: () => { if (dialogResolve) { dialogResolve(null); dialogResolve = null; } } });
    $$('[data-i]', sheet).forEach((b) => (b.onclick = () => {
      const v = buttons[Number(b.dataset.i)].value; dialogResolve = null; closeSheet('#dialog-root'); resolve(v);
    }));
  });
}

/* ---------------- Lançamento (novo / editar) ---------------- */
function openTxSheet(existing = null, presetKind = 'expense') {
  const isRec = !!(existing && existing.__rec);
  const spendAccs = accs();
  const f = {
    kind: existing ? (isRec ? 'fixed' : existing.kind || 'expense') : presetKind,
    cents: existing ? Math.round(existing.amount * 100) : 0,
    desc: existing?.desc || '',
    cat: existing?.cat || cats()[0]?.id,
    acc: existing?.acc || (accById(lastAcc()) ? lastAcc() : spendAccs[0]?.id),
    date: existing?.date || todayISO(),
    n: 1, mode: 'total', catTouched: !!existing
  };
  const descs = [...new Set([...S.tx.filter((t) => t.kind !== 'income').map((t) => t.desc), ...S.rec.map((r) => r.desc)].filter(Boolean))].slice(-300);
  const show = (kinds) => `data-show="${kinds}"`;
  const title = existing ? (isRec ? 'Editar gasto fixo' : existing.kind === 'income' ? 'Editar entrada' : 'Editar gasto') : 'Novo lançamento';

  const sheet = openSheet(`
    <div class="sheet-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    ${existing ? '' : `<div class="seg" id="f-kind">
      <button data-k="expense">Gasto</button><button data-k="income">Entrada</button><button data-k="fixed">Fixo mensal</button></div>`}
    <input id="f-amount" class="amount-input" inputmode="numeric" autocomplete="off" aria-label="Valor">
    <input id="f-desc" class="input" placeholder="Descrição (ex: Uber, mercado, Shopee…)" list="desc-list" autocomplete="off" value="${esc(f.desc)}" enterkeyhint="done">
    <datalist id="desc-list">${descs.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
    <div class="field" ${show('expense fixed')}><label>Categoria</label>
      <div class="chips grid-scroll" id="f-cat">${cats().map((c) => `<button class="chip cat" data-v="${esc(c.id)}" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)}</button>`).join('')}</div></div>
    <div class="field" ${show('expense')}><label>Pagou com</label>
      <div class="chips wrap" id="f-acc">${spendAccs.map((a) => `<button class="chip" data-v="${esc(a.id)}"><span class="dot" style="--c:${a.color}"></span>${esc(a.name)}</button>`).join('')}</div></div>
    <div class="field" ${show('expense income')}><label>Data</label>
      <input type="date" id="f-date" class="input" value="${f.date}"><small id="f-month" class="hint"></small></div>
    ${existing ? '' : `<div class="field" ${show('expense')}><label>Parcelas</label>
      <div class="inst-row">
        <div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><span id="f-n">à vista</span><button type="button" data-step="1" aria-label="Mais">+</button></div>
        <div class="seg small" id="f-mode" hidden><button data-m="total">valor total</button><button data-m="each">por parcela</button></div>
      </div><small id="f-inst" class="hint"></small></div>`}
    <div class="field" ${show('fixed')}><small class="hint">Aparece todo mês a partir de ${monthName(existing?.startMonth || S.month)}${existing?.startMonth ? ' ' + existing.startMonth.slice(0, 4) : ''}.</small></div>
    ${existing?.inst ? `<label class="check"><input type="checkbox" id="f-all"> Aplicar mudanças a todas as ${existing.inst.n} parcelas</label>` : ''}
    <div class="sheet-actions">
      ${existing ? '<button class="btn ghost danger" id="f-del">Excluir</button>' : ''}
      <button class="btn primary" id="f-save">Salvar</button>
    </div>`);

  const amount = $('#f-amount', sheet);
  const setAmount = () => (amount.value = money(f.cents / 100));
  setAmount();
  amount.addEventListener('input', () => {
    f.cents = Number(amount.value.replace(/\D/g, '').slice(0, 11) || 0);
    setAmount();
    try { amount.setSelectionRange(amount.value.length, amount.value.length); } catch (e) {}
    preview();
  });
  amount.addEventListener('focus', () => setTimeout(() => { try { amount.setSelectionRange(amount.value.length, amount.value.length); } catch (e) {} }, 0));

  const mark = (box, attr, val) => box && $$('[' + attr + ']', box).forEach((b) => b.classList.toggle('on', b.getAttribute(attr) === val));
  const refresh = () => {
    sheet.dataset.kind = f.kind;
    mark($('#f-kind', sheet), 'data-k', f.kind);
    mark($('#f-cat', sheet), 'data-v', f.cat);
    mark($('#f-acc', sheet), 'data-v', f.acc);
    mark($('#f-mode', sheet), 'data-m', f.mode);
    $$('[data-show]', sheet).forEach((el) => (el.hidden = !el.dataset.show.split(' ').includes(f.kind)));
    preview();
  };
  const preview = () => {
    const pm = $('#f-month', sheet);
    if (pm) {
      const acc = accById(f.acc);
      if (f.kind === 'income') pm.textContent = `→ entra em ${monthName(ymOf(f.date))}`;
      else if (acc && acc.type === 'credit') pm.textContent = `→ fatura de ${monthLabel(refMonth(f.date, acc))}`;
      else pm.textContent = `→ conta em ${monthLabel(ymOf(f.date))}`;
    }
    const nEl = $('#f-n', sheet);
    if (nEl) {
      nEl.textContent = f.n === 1 ? 'à vista' : f.n + 'x';
      $('#f-mode', sheet).hidden = f.n === 1;
      const v = f.cents / 100, info = $('#f-inst', sheet);
      if (f.n === 1 || !v) info.textContent = '';
      else {
        const first = refMonth(f.date, accById(f.acc));
        const range = `${monthName(first)} → ${monthLabel(addMonths(first, f.n - 1))}`;
        info.textContent = f.mode === 'total'
          ? `${f.n}x de ${money(Math.floor((v / f.n) * 100) / 100)} · ${range}`
          : `${f.n}x de ${money(v)} = ${money(v * f.n)} · ${range}`;
      }
    }
  };

  $('#f-kind', sheet)?.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { f.kind = b.dataset.k; refresh(); } });
  $('#f-cat', sheet).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { f.cat = b.dataset.v; f.catTouched = true; refresh(); } });
  $('#f-acc', sheet).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { f.acc = b.dataset.v; refresh(); } });
  $('#f-mode', sheet)?.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { f.mode = b.dataset.m; refresh(); } });
  $$('[data-step]', sheet).forEach((b) => (b.onclick = () => { f.n = Math.max(1, Math.min(48, f.n + Number(b.dataset.step))); refresh(); }));
  $('#f-date', sheet).addEventListener('change', (e) => { f.date = e.target.value || todayISO(); preview(); });
  $('#f-desc', sheet).addEventListener('change', (e) => {
    f.desc = e.target.value;
    if (f.catTouched) return;
    const q = f.desc.trim().toLowerCase();
    const past = [...S.tx].filter((t) => t.kind !== 'income' && (t.desc || '').toLowerCase() === q).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
      || S.rec.find((r) => (r.desc || '').toLowerCase() === q);
    if (past) { if (past.cat) f.cat = past.cat; if (past.acc && accById(past.acc)) f.acc = past.acc; refresh(); }
  });
  $('#f-desc', sheet).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

  $('#f-save', sheet).onclick = () => {
    f.desc = $('#f-desc', sheet).value.trim();
    const amountV = f.cents / 100;
    if (!amountV) { toast('Digite o valor', true); amount.focus(); return; }
    if (!f.desc) f.desc = f.kind === 'income' ? 'Entrada' : catById(f.cat).name;
    saveTx(existing, f, amountV, $('#f-all', sheet)?.checked);
    closeSheet();
    toast(existing ? 'Atualizado ♡' : 'Salvo ♡');
  };
  $('#f-del', sheet)?.addEventListener('click', async () => {
    if (isRec) {
      const v = await choose('Remover gasto fixo', `“${existing.desc}”`, [
        { label: `Encerrar (some a partir de ${monthName(S.month)})`, value: 'end' },
        { label: 'Excluir de todos os meses', value: 'del', cls: 'danger' }]);
      if (!v) return;
      if (v === 'end') store.put('recurring', existing.id, { ...existing, endMonth: addMonths(S.month, -1) }).catch(onWriteError);
      else store.del('recurring', existing.id).catch(onWriteError);
    } else if (existing.inst) {
      const group = S.tx.filter((t) => t.inst && t.inst.group === existing.inst.group);
      const v = await choose('Excluir parcela', `${existing.desc} ${existing.inst.i}/${existing.inst.n}`, [
        { label: 'Só esta parcela', value: 'one' },
        { label: `Todas as ${group.length} parcelas`, value: 'all', cls: 'danger' }]);
      if (!v) return;
      if (v === 'one') store.del('transactions', existing.id).catch(onWriteError);
      else store.delMany('transactions', group.map((t) => t.id)).catch(onWriteError);
    } else {
      const v = await choose('Excluir lançamento?', `${existing.desc} · ${money(existing.amount)}`, [{ label: 'Excluir', value: 'del', cls: 'danger' }]);
      if (!v) return;
      store.del('transactions', existing.id).catch(onWriteError);
    }
    closeSheet(); toast('Excluído');
  });

  refresh();
  if (!existing) amount.focus();
}

function saveTx(existing, f, amountV, applyAll) {
  const now = Date.now();
  if (f.kind === 'fixed') {
    const base = existing && existing.__rec ? { ...existing } : { id: newId(), startMonth: S.month, endMonth: null, createdAt: now };
    store.put('recurring', base.id, { by: S.user.uid, ...base, desc: f.desc, amount: amountV, cat: f.cat }).catch(onWriteError);
    return;
  }
  if (f.kind === 'income') {
    const id = existing ? existing.id : newId();
    store.put('transactions', id, { ...(existing || { createdAt: now, by: S.user.uid }), kind: 'income', desc: f.desc, amount: amountV, date: f.date, month: ymOf(f.date), cat: null, acc: null }).catch(onWriteError);
    return;
  }
  const acc = accById(f.acc);
  const base = refMonth(f.date, acc);
  try { localStorage.setItem('mb-last-acc', f.acc); } catch (e) {}

  if (existing) {
    if (existing.inst && applyAll) {
      const group = S.tx.filter((t) => t.inst && t.inst.group === existing.inst.group);
      store.putMany('transactions', group.map((t) => ({ ...t, desc: f.desc, amount: amountV, cat: f.cat, acc: f.acc, date: f.date, month: addMonths(base, t.inst.i - 1) }))).catch(onWriteError);
    } else {
      const month = existing.inst ? addMonths(base, existing.inst.i - 1) : base;
      store.put('transactions', existing.id, { ...existing, desc: f.desc, amount: amountV, cat: f.cat, acc: f.acc, date: f.date, month }).catch(onWriteError);
    }
    return;
  }
  if (f.n === 1) {
    store.put('transactions', newId(), { kind: 'expense', desc: f.desc, amount: amountV, cat: f.cat, acc: f.acc, date: f.date, month: base, inst: null, createdAt: now, by: S.user.uid }).catch(onWriteError);
    return;
  }
  // Parcelado: cria todas as parcelas nas faturas seguintes.
  const group = newId();
  let per, last;
  if (f.mode === 'total') { per = Math.floor((amountV / f.n) * 100) / 100; last = round2(amountV - per * (f.n - 1)); }
  else { per = amountV; last = amountV; }
  const items = Array.from({ length: f.n }, (_, i) => ({
    id: newId() + i, kind: 'expense', desc: f.desc, amount: i === f.n - 1 ? last : per, cat: f.cat, acc: f.acc, date: f.date,
    month: addMonths(base, i), inst: { i: i + 1, n: f.n, group }, createdAt: now + i, by: S.user.uid
  }));
  store.putMany('transactions', items).catch(onWriteError);
}

/* ---------------- Formulário genérico (ajustes) ---------------- */
function openForm({ title, fields, values = {}, onSave, onDelete }) {
  const input = (fd) => {
    const v = values[fd.key] ?? fd.default ?? '';
    if (fd.type === 'select') return `<select class="input" name="${fd.key}">${fd.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    if (fd.type === 'color') return `<input class="input color" type="color" name="${fd.key}" value="${esc(v || '#a78bfa')}">`;
    if (fd.type === 'money') return `<input class="input" name="${fd.key}" inputmode="decimal" placeholder="0,00" value="${v === '' ? '' : esc(String(v).replace('.', ','))}">`;
    if (fd.type === 'day') return `<input class="input" name="${fd.key}" type="number" min="1" max="31" inputmode="numeric" value="${esc(v)}">`;
    return `<input class="input" name="${fd.key}" ${fd.max ? `maxlength="${fd.max}"` : ''} placeholder="${esc(fd.placeholder || '')}" value="${esc(v)}">`;
  };
  const sheet = openSheet(`
    <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fechar">${ICON.close}</button></div>
    <form id="gen-form" class="stack">
      ${fields.map((fd) => `<div class="field" ${fd.showIf ? `data-showif="${fd.showIf}"` : ''}><label>${esc(fd.label)}</label>${input(fd)}${fd.hint ? `<small class="hint">${esc(fd.hint)}</small>` : ''}</div>`).join('')}
      <div class="sheet-actions">${onDelete ? '<button type="button" class="btn ghost danger" id="g-del">Excluir</button>' : ''}<button class="btn primary" type="submit">Salvar</button></div>
    </form>`);
  const form = $('#gen-form', sheet);
  const cond = () => $$('[data-showif]', form).forEach((el) => { const [k, val] = el.dataset.showif.split('='); el.hidden = form.elements[k].value !== val; });
  form.addEventListener('change', cond); cond();
  form.onsubmit = (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach((fd) => {
      const raw = form.elements[fd.key].value;
      out[fd.key] = fd.type === 'money' ? round2(parseNum(raw)) : fd.type === 'day' ? Math.max(1, Math.min(31, parseInt(raw, 10) || 1)) : raw.trim();
    });
    if (fields.some((fd) => fd.required && !out[fd.key])) { toast('Preencha o nome', true); return; }
    onSave(out); closeSheet(); toast('Salvo ♡');
  };
  $('#g-del', sheet)?.addEventListener('click', async () => {
    const ok = await choose('Excluir?', '', [{ label: 'Excluir', value: true, cls: 'danger' }]);
    if (ok) { onDelete(); closeSheet(); toast('Excluído'); }
  });
}

const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'item';

function editIncome(id) {
  const cur = S.settings.incomes.find((r) => r.id === id);
  openForm({
    title: cur ? 'Editar renda' : 'Nova renda',
    fields: [{ key: 'name', label: 'Nome', required: true, placeholder: 'Ex: Salário' }, { key: 'amount', label: 'Valor por mês', type: 'money' }],
    values: cur || {},
    onSave: (v) => saveSettings({ incomes: upsert(S.settings.incomes, { id: cur ? cur.id : newId(), ...v }) }),
    onDelete: cur ? () => saveSettings({ incomes: S.settings.incomes.filter((r) => r.id !== id) }) : null
  });
}
function editCat(id) {
  const cur = cats().find((c) => c.id === id);
  openForm({
    title: cur ? 'Editar categoria' : 'Nova categoria',
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'icon', label: 'Ícone (um emoji)', max: 4, placeholder: '🏷️' },
      { key: 'color', label: 'Cor', type: 'color' }
    ],
    values: cur || { icon: '🏷️', color: '#a78bfa' },
    onSave: (v) => {
      let nid = cur ? cur.id : slug(v.name);
      if (!cur && cats().some((c) => c.id === nid)) nid += newId().slice(-4);
      saveSettings({ categories: upsert(cats(), { id: nid, ...v, icon: v.icon || '🏷️' }) });
    },
    onDelete: cur ? () => saveSettings({ categories: cats().filter((c) => c.id !== id) }) : null
  });
}
function editAcc(id) {
  const cur = accById(id);
  openForm({
    title: cur ? 'Editar conta' : 'Nova conta ou cartão',
    fields: [
      { key: 'name', label: 'Nome', required: true, placeholder: 'Ex: Cartão Inter' },
      { key: 'type', label: 'Tipo', type: 'select', options: [['credit', 'Cartão de crédito'], ['debit', 'Débito / Pix / dinheiro']] },
      { key: 'closingDay', label: 'Dia que a fatura fecha', type: 'day', default: 1, showIf: 'type=credit', hint: 'Compras feitas a partir desse dia vão para a próxima fatura.' },
      { key: 'dueDay', label: 'Dia do vencimento', type: 'day', default: 10, showIf: 'type=credit' },
      { key: 'color', label: 'Cor', type: 'color' }
    ],
    values: cur || { type: 'credit', color: '#6fb3e0' },
    onSave: (v) => {
      let nid = cur ? cur.id : slug(v.name);
      if (!cur && accs().some((a) => a.id === nid)) nid += newId().slice(-4);
      saveSettings({ accounts: upsert(accs(), { id: nid, ...v }) });
    },
    onDelete: cur && accs().length > 1 ? () => saveSettings({ accounts: accs().filter((a) => a.id !== id) }) : null
  });
}

/* ---------------- Exportar / backup ---------------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCsv() {
  const d = monthData(S.month);
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const num = (v) => String(v.toFixed(2)).replace('.', ',');
  const rows = [['Data', 'Descrição', 'Categoria', 'Conta', 'Parcela', 'Tipo', 'Valor']];
  d.fixed.forEach((r) => rows.push(['', r.desc, catById(r.cat).name, 'Gastos fixos', '', 'Fixo', num(r.amount)]));
  [...d.exp, ...d.inc].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((t) => rows.push([
    ddmm(t.date), t.desc, t.kind === 'income' ? '' : catById(t.cat).name, t.kind === 'income' ? '' : accById(t.acc)?.name || '',
    t.inst ? `${t.inst.i}/${t.inst.n}` : '', t.kind === 'income' ? 'Entrada' : 'Gasto', num(t.amount)]));
  download(`gastos-${S.month}.csv`, '﻿' + rows.map((r) => r.map(q).join(';')).join('\n'), 'text/csv;charset=utf-8');
}
function backup() {
  download(`meu-bolso-backup-${todayISO()}.json`, JSON.stringify({ version: 1, settings: S.settings, transactions: S.tx, recurring: S.rec }, null, 1), 'application/json');
}
async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data.settings || !Array.isArray(data.transactions)) throw new Error('arquivo inválido');
    const ok = await choose('Restaurar backup?', `${data.transactions.length} lançamentos e ${(data.recurring || []).length} gastos fixos serão adicionados/atualizados.`, [{ label: 'Restaurar', value: true, cls: 'primary' }]);
    if (!ok) return;
    saveSettings(data.settings);
    await store.putMany('transactions', data.transactions);
    await store.putMany('recurring', data.recurring || []);
    toast('Backup restaurado ♡');
  } catch (e) { toast('Não consegui ler o backup: ' + e.message, true); }
}

/* =========================================================
   Eventos
   ========================================================= */
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), bad ? 4500 : 1800);
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !$('#app').contains(el)) return;
  const a = el.dataset.act;
  switch (a) {
    case 'view': S.view = el.dataset.v; render(); window.scrollTo(0, 0); break;
    case 'prev': S.month = addMonths(S.month, -1); render(); break;
    case 'next': S.month = addMonths(S.month, 1); render(); break;
    case 'add': openTxSheet(); break;
    case 'goacc': S.filter = el.dataset.acc; S.view = 'list'; render(); window.scrollTo(0, 0); break;
    case 'filter': S.filter = el.dataset.f; render(); break;
    case 'edit': {
      if (el.dataset.type === 'rec') { const r = S.rec.find((x) => x.id === el.dataset.id); if (r) openTxSheet({ ...r, __rec: true }); }
      else { const t = S.tx.find((x) => x.id === el.dataset.id); if (t) openTxSheet(t); }
      break;
    }
    case 'theme': setTheme(el.dataset.t); break;
    case 'editIncome': editIncome(el.dataset.id); break;
    case 'addIncome': editIncome(null); break;
    case 'editRec': { const r = S.rec.find((x) => x.id === el.dataset.id); if (r) openTxSheet({ ...r, __rec: true }); break; }
    case 'addRec': openTxSheet(null, 'fixed'); break;
    case 'editCat': editCat(el.dataset.id); break;
    case 'addCat': editCat(null); break;
    case 'editAcc': editAcc(el.dataset.id); break;
    case 'addAcc': editAcc(null); break;
    case 'exportCsv': exportCsv(); break;
    case 'backup': backup(); break;
    case 'restore': { const inp = $('#restore-file'); inp.onchange = () => inp.files[0] && restore(inp.files[0]); inp.click(); break; }
    case 'invite': sendInvite(); break;
    case 'myName': openForm({ title: 'Seu nome', fields: [{ key: 'name', label: 'Como você aparece para a outra pessoa', required: true, max: 24 }], values: { name: S.sheet?.names?.[S.user.uid] || myName() }, onSave: (v) => share.setName(v.name).catch(onWriteError) }); break;
    case 'removeMember': {
      const ok = await choose('Remover da planilha?', nameOf(el.dataset.id) + ' deixa de ver e lançar nesta planilha.', [{ label: 'Remover', value: true, cls: 'danger' }]);
      if (ok) share.removeMember(el.dataset.id).then(() => toast('Removido')).catch(onWriteError);
      break;
    }
    case 'leaveSheet': {
      const ok = await choose('Sair desta planilha?', 'Os lançamentos continuam com a outra pessoa. Você começa uma planilha nova, só sua.', [{ label: 'Sair da planilha', value: true, cls: 'danger' }]);
      if (ok) share.leave(myName()).then(() => toast('Você saiu da planilha')).catch(onWriteError);
      break;
    }
    case 'rename': openForm({ title: 'Nome do app', fields: [{ key: 'appName', label: 'Nome', required: true, max: 24 }], values: S.settings, onSave: (v) => saveSettings(v) }); break;
    case 'logout': {
      const ok = await choose('Sair da conta?', '', [{ label: 'Sair', value: true, cls: 'danger' }]);
      if (ok) authApi.logout();
      break;
    }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'invite-open') share.setInviteOpen(e.target.checked).catch(onWriteError);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { S.search = e.target.value; const b = $('#list-body'); if (b) b.innerHTML = listBodyHTML(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#dialog-root').classList.contains('open')) closeSheet('#dialog-root', () => { if (dialogResolve) { dialogResolve(null); dialogResolve = null; } });
  else if ($('#sheet-root').classList.contains('open')) closeSheet();
});

/* =========================================================
   Início
   ========================================================= */
function onUser(user) {
  if (unwatch) { unwatch(); unwatch = null; }
  S.user = user; S.tx = []; S.rec = []; S.settings = null; S.sheet = null; S.monthSet = false; seeding = false;
  if (!user) { render(); return; }
  render();
  unwatch = watchUser(user.uid, {
    profile: (p) => { if (p && p.theme && p.theme !== document.documentElement.dataset.theme) { applyTheme(p.theme); rerenderSafe(); } },
    sheet: (sh) => { S.sheet = sh; rerenderSafe(); maybeJoin(); },
    reset: () => { S.tx = []; S.rec = []; S.settings = null; S.sheet = null; seeding = false; render(); },
    noSheet: async () => {
      // Primeira vez: se veio por convite, já entra na planilha de quem convidou.
      if (S.invite) {
        const inv = S.invite; clearInvite();
        try { await share.join(inv, myName()); toast('Você entrou na planilha compartilhada ♡'); return; }
        catch (e) { console.error(e); toast(JOIN_ERR, true); }
      }
      share.createOwn(myName()).catch(onWriteError);
    },
    lost: () => {
      // Sem acesso à planilha (foi removido ou as regras do banco não foram publicadas).
      if (lostOnce) { toast('Sem permissão no banco. Confira as Regras do Firestore (etapa 3 do guia).', true); return; }
      lostOnce = true;
      toast('Você não faz mais parte daquela planilha. Criando uma nova só sua…', true);
      share.createOwn(myName()).catch(onWriteError);
    },
    tx: (list) => { S.tx = list; rerenderSafe(); },
    rec: (list) => { S.rec = list; rerenderSafe(); },
    settings: ({ data, exists, fromCache }) => {
      if (!exists) {
        if (fromCache) return; // ainda esperando o servidor confirmar
        if (!seeding) {
          seeding = true;
          store.saveSettings(DEFAULT_SETTINGS).catch(onWriteError);
          store.putMany('recurring', DEFAULT_RECURRING.map((r) => ({ ...r, by: user.uid }))).catch(onWriteError);
          S.settings = { ...DEFAULT_SETTINGS };
        }
      } else {
        S.settings = { ...DEFAULT_SETTINGS, ...data };
      }
      if (!S.monthSet && S.settings) {
        const credit = S.settings.accounts.find((a) => a.type === 'credit');
        S.month = refMonth(todayISO(), credit);
        S.monthSet = true;
      }
      rerenderSafe();
      maybeJoin();
    },
    error: (e) => { console.error(e); toast(e.code === 'permission-denied' ? 'Sem permissão no banco. Confira as Regras do Firestore (etapa 3 do guia).' : 'Erro de conexão: ' + e.message, true); }
  });
}
// Evita redesenhar a tela enquanto alguém digita na busca.
function rerenderSafe() {
  const active = document.activeElement;
  if (active && active.id === 'search' && S.view === 'list' && S.settings) { const b = $('#list-body'); if (b) { b.innerHTML = listBodyHTML(); return; } }
  render();
}

S.invite = readInvite();
applyTheme(document.documentElement.dataset.theme);
makeDots();
render();
initBackend(onUser).catch((e) => {
  console.error(e);
  $('#app').innerHTML = `<div class="center-screen"><p>Não consegui carregar o Firebase.</p><p class="muted">${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button></div>`;
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
