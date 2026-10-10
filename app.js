import { categories, items, operations, warehouses } from './data.js';

/* ================= УТИЛИТЫ ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
};

const statusLabel = { 'in-stock': 'В наличии', 'low-stock': 'Низкий остаток', 'out-of-stock': 'Нет в наличии' };
const statusClass = { 'in-stock': 'badge--ok', 'low-stock': 'badge--warn', 'out-of-stock': 'badge--err' };
const opStatus = { completed: 'Завершено', 'in-progress': 'В работе', pending: 'Ожидает' };
const opStatusClass = { completed: 'badge--ok', 'in-progress': 'badge--warn', pending: 'badge--neutral' };
const opType = { receipt: 'Приход', issue: 'Расход', inventory: 'Инвентаризация', 'write-off': 'Списание' };
const fmtDate = iso => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = iso => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const catById = id => categories.find(c => c.id === id);

/* ================= ТЕМА ================= */
const themeToggle = $('#theme-toggle');
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const order = ['light', 'dark', 'contrast'];
  const next = order[(order.indexOf(cur) + 1) % order.length];
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('wms-theme', next);
  toast('Тема: ' + next, 'ok');
});

const accentPicker = $('#accent-picker');
accentPicker.addEventListener('input', e => {
  const hex = e.target.value;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`);
  localStorage.setItem('wms-accent', hex);
});
if (localStorage.getItem('wms-accent')) {
  accentPicker.value = localStorage.getItem('wms-accent');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('wms-theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  }
});

/* ================= SIDEBAR ================= */
const hamburger = $('#hamburger');
const sidebar = $('#sidebar');
const overlay = $('#overlay');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('show'));
  hamburger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  sidebar.querySelector('a')?.focus();
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  setTimeout(() => { overlay.hidden = true; }, 250);
  hamburger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
hamburger.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
overlay.addEventListener('click', closeSidebar);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar(); });

/* Навигация */
$$('.main-nav a, .sidebar a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('.main-nav a').forEach(x => x.classList.remove('is-active'));
      $$('.sidebar a').forEach(x => x.classList.remove('is-active'));
      a.classList.add('is-active');
      if (sidebar.classList.contains('open')) closeSidebar();
    }
  });
});

/* ================= МОДАЛЬНОЕ ОКНО ================= */
const modal = $('#modal');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');
let lastFocus = null;
let focusable = [];

function openModal(title, contentNodes) {
  lastFocus = document.activeElement;
  modalTitle.textContent = title;
  modalBody.replaceChildren(...contentNodes);
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter(n => !n.disabled);
  focusable[0]?.focus();
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus();
}
modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => {
  if (modal.hidden) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key === 'Tab') {
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ================= TOAST ================= */
const toastBox = $('#toast-container');
function toast(msg, type = 'info') {
  const t = el('div', { class: `toast toast--${type}`, role: 'status' }, msg);
  toastBox.append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ================= СЧЁТЧИКИ ================= */
function animateCounters() {
  $$('[data-counter]').forEach(el => {
    const target = +el.dataset.counter;
    const suffix = el.dataset.suffix || '';
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(t); }
      el.textContent = cur + suffix;
    }, 30);
  });
}

/* ================= РЕНДЕР КАРТОЧКИ ================= */
function renderItemCard(item) {
  const cat = catById(item.categoryId);
  const card = el('article', { class: 'item-card', tabindex: '0', 'data-id': item.id, 'aria-label': item.name });
  card.append(
    el('header', {},
      el('div', {},
        el('p', { class: 'id', text: `${item.id.toUpperCase()} · ${item.sku}` }),
        el('h3', { text: item.name }),
        el('p', { class: 'sku', text: cat?.name || '—' })
      ),
      el('span', { class: `badge ${statusClass[item.status]}`, text: statusLabel[item.status] })
    ),
    el('p', { class: 'desc', text: item.description }),
    el('div', { class: 'meta' },
      el('time', { datetime: item.updatedAt, text: 'Обновлено: ' + fmtDate(item.updatedAt) }),
      el('span', { text: '· ' + item.responsible })
    ),
    el('ul', { class: 'tags' }, ...item.tags.map(t => el('li', {}, el('span', { class: 'badge badge--neutral', text: '#' + t })))),
    el('footer', {},
      el('div', {},
        el('span', { class: 'qty', text: `${item.quantity} ${item.unit}` }),
        el('p', { class: 'id', text: `Мин: ${item.minQuantity} ${item.unit}` })
      ),
      el('p', { class: 'id', text: `📍 Склад ${item.location.warehouse}` })
    )
  );
  card.addEventListener('click', () => showItemModal(item));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showItemModal(item); } });
  return card;
}

/* ================= РЕНДЕР ТАБЛИЦЫ ================= */
function renderItemsTable(list) {
  const table = el('table', { class: 'items-table' });
  const cols = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Название' },
    { key: 'category', label: 'Категория' },
    { key: 'status', label: 'Статус' },
    { key: 'qty', label: 'Кол-во' },
    { key: 'updatedAt', label: 'Обновлено' }
  ];

  const [curKey, curDir] = state.sort.split('-');

  const thead = el('thead', {}, el('tr', {}, ...cols.map(c => {
    const th = el('th', { scope: 'col', 'data-sort': c.key, text: c.label });
    if (c.key === curKey) {
      th.setAttribute('aria-sort', curDir === 'asc' ? 'ascending' : 'descending');
    }
    return th;
  })));

  const tbody = el('tbody', {}, ...list.map(it => {
    const cat = catById(it.categoryId);
    const tr = el('tr', { 'data-id': it.id, tabindex: '0' });
    tr.append(
      el('td', { 'data-label': 'SKU' }, el('span', { class: 'mono', text: it.sku })),
      el('td', { 'data-label': 'Название', text: it.name }),
      el('td', { 'data-label': 'Категория', text: cat?.name || '—' }),
      el('td', { 'data-label': 'Статус' }, el('span', { class: `badge ${statusClass[it.status]}`, text: statusLabel[it.status] })),
      el('td', { 'data-label': 'Кол-во', text: `${it.quantity} ${it.unit}` }),
      el('td', { 'data-label': 'Обновлено', text: fmtDate(it.updatedAt) })
    );
    tr.addEventListener('click', () => showItemModal(it));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') showItemModal(it); });
    return tr;
  }));

  table.append(
    el('caption', { text: `Остатки на складе — ${list.length} позиций` }),
    thead,
    tbody
  );

  // Обработчики клика по th для сортировки
  thead.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const [k, d] = state.sort.split('-');
      const newDir = (k === key && d === 'asc') ? 'desc' : 'asc';
      state.sort = `${key}-${newDir}`;
      state.page = 1;
      // синхронизация с select
      const sortSelect = $('#sort-select');
      const optValue = `${key}-${newDir}`;
      if ([...sortSelect.options].some(o => o.value === optValue)) {
        sortSelect.value = optValue;
      }
      renderItems();
    });
  });

  return table;
}

/* ================= МОДАЛКА ДЛЯ ITEM ================= */
function showItemModal(item) {
  const cat = catById(item.categoryId);
  const dl = el('dl', {},
    el('dt', { text: 'ID' }), el('dd', { text: item.id }),
    el('dt', { text: 'SKU' }), el('dd', { text: item.sku }),
    el('dt', { text: 'Категория' }), el('dd', { text: cat?.name || '—' }),
    el('dt', { text: 'Статус' }), el('dd', {}, el('span', { class: `badge ${statusClass[item.status]}`, text: statusLabel[item.status] })),
    el('dt', { text: 'Количество' }), el('dd', { text: `${item.quantity} ${item.unit}` }),
    el('dt', { text: 'Мин. остаток' }), el('dd', { text: `${item.minQuantity} ${item.unit}` }),
    el('dt', { text: 'Цена' }), el('dd', { text: item.price.toLocaleString('ru-RU') + ' ₽' }),
    el('dt', { text: 'Местоположение' }), el('dd', { text: `Склад ${item.location.warehouse} / ${item.location.aisle} / ${item.location.shelf} / ${item.location.bin}` }),
    el('dt', { text: 'Поставщик' }), el('dd', { text: item.supplier }),
    el('dt', { text: 'Ответственный' }), el('dd', { text: item.responsible }),
    el('dt', { text: 'Создано' }), el('dd', {}, el('time', { datetime: item.createdAt, text: fmtDateTime(item.createdAt) })),
    el('dt', { text: 'Обновлено' }), el('dd', {}, el('time', { datetime: item.updatedAt, text: fmtDateTime(item.updatedAt) })),
    el('dt', { text: 'Описание' }), el('dd', { text: item.description })
  );
  openModal(item.name, [dl]);
}

/* ================= ФИЛЬТРЫ И РЕНДЕР ================= */
const state = {
  search: '',
  category: '',
  statuses: [],
  view: 'cards',
  sort: 'name-asc',
  page: 1,
  perPage: 6
};

function getFiltered() {
  let list = [...items];
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    );
  }
  if (state.category) list = list.filter(i => i.categoryId === state.category);
  if (state.statuses.length) list = list.filter(i => state.statuses.includes(i.status));

  const [key, dir] = state.sort.split('-');
  list.sort((a, b) => {
    let va, vb;
    if (key === 'name') { va = a.name; vb = b.name; }
    else if (key === 'qty') { va = a.quantity; vb = b.quantity; }
    else if (key === 'category') { va = catById(a.categoryId)?.name || ''; vb = catById(b.categoryId)?.name || ''; }
    else if (key === 'sku') { va = a.sku; vb = b.sku; }
    else if (key === 'status') { va = a.status; vb = b.status; }
    else if (key === 'updatedAt') { va = a.updatedAt; vb = b.updatedAt; }
    else { va = a[key]; vb = b[key]; }
    if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb, 'ru') : vb.localeCompare(va, 'ru');
    return dir === 'asc' ? va - vb : vb - va;
  });
  return list;
}

function renderItems() {
  const container = $('#items-container');
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.perPage;
  const pageItems = filtered.slice(start, start + state.perPage);

  $('#items-found').textContent = filtered.length;
  container.dataset.view = state.view;

  if (!filtered.length) {
    container.replaceChildren(
      el('div', { class: 'empty' },
        el('p', { text: '📦' }),
        el('p', { text: 'Ничего не найдено' }),
        el('p', { text: 'Попробуйте изменить фильтры' })
      )
    );
  } else if (state.view === 'table') {
    container.replaceChildren(renderItemsTable(pageItems));
  } else {
    container.replaceChildren(...pageItems.map(renderItemCard));
  }

  renderPagination(totalPages);
}

function renderPagination(total) {
  const nav = $('#pagination');
  nav.replaceChildren();
  if (total <= 1) return;

  const mk = (label, page, disabled = false, current = false) => {
    const b = el('button', { type: 'button', text: label, disabled: disabled || null });
    if (current) b.setAttribute('aria-current', 'page');
    b.addEventListener('click', () => { state.page = page; renderItems(); });
    return b;
  };

  nav.append(mk('‹', state.page - 1, state.page === 1));

  const pages = new Set([1, total, state.page, state.page - 1, state.page + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  let prev = 0;
  sorted.forEach(p => {
    if (p - prev > 1) nav.append(el('span', { class: 'dots', text: '…' }));
    nav.append(mk(String(p), p, false, p === state.page));
    prev = p;
  });

  nav.append(mk('›', state.page + 1, state.page === total));
}

/* Слушатели фильтров */
$('#search-input').addEventListener('input', e => {
  clearTimeout(window._searchT);
  window._searchT = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; renderItems(); }, 250);
});
$('#category-select').addEventListener('change', e => { state.category = e.target.value; state.page = 1; renderItems(); });
$('#sort-select').addEventListener('change', e => { state.sort = e.target.value; state.page = 1; renderItems(); });
$$('input[name="status"]').forEach(cb => cb.addEventListener('change', () => {
  state.statuses = $$('input[name="status"]:checked').map(c => c.value);
  state.page = 1; renderItems();
}));
$$('input[name="view"]').forEach(r => r.addEventListener('change', e => { state.view = e.target.value; renderItems(); }));
$('#filters-form').addEventListener('reset', () => {
  setTimeout(() => {
    state.search = ''; state.category = ''; state.statuses = []; state.view = 'cards'; state.page = 1;
    renderItems();
  }, 0);
});
$('#refresh-btn').addEventListener('click', () => {
  loadItemsWithSkeleton();
  toast('Данные обновлены', 'ok');
});

/* Скелетон-загрузка */
function loadItemsWithSkeleton() {
  const container = $('#items-container');
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(
    ...Array.from({ length: 3 }, () => el('div', { class: 'skeleton' },
      el('div', { class: 'skeleton-line skeleton-line--short' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line skeleton-line--mid' })
    ))
  );
  setTimeout(() => { container.setAttribute('aria-busy', 'false'); renderItems(); }, 500);
}

/* ================= ОПЕРАЦИИ (TABS) ================= */
let currentOpTab = 'all';
function renderOperations() {
  const panel = $('#panel-operations');
  const list = currentOpTab === 'all' ? operations : operations.filter(o => o.type === currentOpTab);
  if (!list.length) {
    panel.replaceChildren(el('div', { class: 'empty' }, el('p', { text: 'Нет операций' })));
    return;
  }
  panel.replaceChildren(...list.map(op => {
    const linkedItem = items.find(i => i.id === op.itemId);
    const displayName = linkedItem?.name || op.itemName;
    const row = el('div', { class: 'op-row', tabindex: '0' });
    row.append(
      el('span', { class: 'num', text: op.documentNumber }),
      el('div', { class: 'name' },
        el('p', { text: displayName }),
        el('p', { class: 'num', text: `${opType[op.type]} · ${op.quantity} ${op.unit}` })
      ),
      el('span', { class: `priority priority--${op.priority}` }, op.priority === 'high' ? 'Высокий' : op.priority === 'medium' ? 'Средний' : 'Низкий'),
      el('span', { class: `badge ${opStatusClass[op.status]}`, text: opStatus[op.status] }),
      el('time', { class: 'date', datetime: op.createdAt, text: fmtDate(op.createdAt) })
    );
    row.addEventListener('click', () => showOperationModal(op));
    row.addEventListener('keydown', e => { if (e.key === 'Enter') showOperationModal(op); });
    return row;
  }));
}

function showOperationModal(op) {
  const linkedItem = items.find(i => i.id === op.itemId);
  const displayName = linkedItem?.name || op.itemName;
  const dl = el('dl', {},
    el('dt', { text: 'Документ' }), el('dd', { text: op.documentNumber }),
    el('dt', { text: 'Тип' }), el('dd', { text: opType[op.type] }),
    el('dt', { text: 'Товар' }), el('dd', { text: `${displayName} (${op.sku})` }),
    el('dt', { text: 'Количество' }), el('dd', { text: `${op.quantity} ${op.unit}` }),
    el('dt', { text: 'Откуда' }), el('dd', { text: op.fromLocation }),
    el('dt', { text: 'Куда' }), el('dd', { text: op.toLocation }),
    el('dt', { text: 'Статус' }), el('dd', {}, el('span', { class: `badge ${opStatusClass[op.status]}`, text: opStatus[op.status] })),
    el('dt', { text: 'Ответственный' }), el('dd', { text: op.responsible }),
    el('dt', { text: 'Дата' }), el('dd', {}, el('time', { datetime: op.createdAt, text: fmtDateTime(op.createdAt) })),
    el('dt', { text: 'Комментарий' }), el('dd', { text: op.comment })
  );
  openModal(`Операция ${op.documentNumber}`, [dl]);
}

/* Табы операций — ПОРЯДОК ВАЖЕН: соответствует HTML */
const tabIds = ['all', 'receipt', 'issue', 'inventory', 'write-off'];
const tabs = $$('#operations-tabs .tab');
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => activateTab(i));
  tab.addEventListener('keydown', e => {
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) { e.preventDefault(); activateTab(next); tabs[next].focus(); }
  });
});
function activateTab(i) {
  tabs.forEach((t, idx) => {
    const on = idx === i;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  currentOpTab = tabIds[i];
  renderOperations();
}

/* ================= АККОРДЕОН КАТЕГОРИЙ ================= */
function renderAccordion() {
  const root = $('#categories-accordion');
  root.replaceChildren(...categories.map(c => {
    const head = el('button', {
      class: 'acc-head',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': `acc-${c.id}`
    }, el('span', {}, c.name), el('span', { class: 'badge badge--neutral', text: c.itemCount + ' шт' }));

    const body = el('div', { class: 'acc-body', id: `acc-${c.id}` },
      el('p', { text: c.description }),
      el('p', {}, el('strong', { text: 'Ответственный: ' }), c.responsible),
      el('p', {}, el('strong', { text: 'Создано: ' }), el('time', { datetime: c.createdAt, text: fmtDate(c.createdAt) })),
      el('p', {}, el('strong', { text: 'Теги: ' }), c.tags.join(', '))
    );

    head.addEventListener('click', () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', !open);
      body.classList.toggle('open', !open);
    });

    const item = el('article', { class: 'acc-item' });
    item.append(head, body);
    return item;
  }));
}

/* ================= СКЛАДЫ ================= */
function renderWarehouses() {
  const container = $('#warehouses-container');
  container.replaceChildren(...warehouses.slice(0, 6).map(w => {
    const pct = Math.round((w.used / w.capacity) * 100);
    const card = el('article', { class: 'wh-card' });
    card.append(
      el('h3', { text: w.name }),
      el('p', { text: w.address }),
      el('p', { text: `Ответственный: ${w.responsible}` }),
      el('p', { text: `Заполнено: ${pct}% (${w.used} / ${w.capacity})` }),
      el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` }))
    );
    return card;
  }));

  const load = $('#warehouse-load');
  load.replaceChildren(...warehouses.map(w => {
    const pct = Math.round((w.used / w.capacity) * 100);
    return el('li', {},
      el('strong', { text: `Склад ${w.code}: ` }),
      `${pct}%`,
      el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` }))
    );
  }));
}

/* ================= ОПОВЕЩЕНИЯ ================= */
function renderAlerts() {
  const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.minQuantity);
  const outStock = items.filter(i => i.quantity === 0);
  const list = $('#alerts-list');
  const alerts = [];
  outStock.forEach(i => alerts.push({ text: `Нет в наличии: ${i.name}`, type: 'err' }));
  lowStock.forEach(i => alerts.push({ text: `Низкий остаток: ${i.name} (${i.quantity})`, type: 'warn' }));
  if (!alerts.length) alerts.push({ text: 'Все показатели в норме', type: '' });
  list.replaceChildren(...alerts.map(a => el('li', { class: a.type }, a.text)));
}

/* ================= СЧЁТЧИКИ В SIDEBAR ================= */
$('#items-count').textContent = items.length;
$('#operations-count').textContent = operations.length;

/* ================= ЗАПУСК ================= */
function init() {
  const catSelect = $('#category-select');
  categories.forEach(c => catSelect.append(el('option', { value: c.id, text: c.name })));

  renderAccordion();
  renderWarehouses();
  renderAlerts();
  renderOperations();
  loadItemsWithSkeleton();
  animateCounters();

  setTimeout(() => toast('Добро пожаловать в WMS!', 'ok'), 300);
}
init();