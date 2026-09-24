/**
 * Tickets · VelocityBench Hub — client SPA
 * Auth + data: your Supabase cloud project (anon key only).
 * Static host: GitHub Pages. Anon key only in this app.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'med', label: 'Med' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];
const HORIZONS = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: '7d', label: 'Next 7d' },
  { id: '30d', label: 'Next 30d' },
];

const PLACEHOLDER_URL = 'YOUR_PROJECT';
const PLACEHOLDER_KEY = 'YOUR_SUPABASE_ANON_KEY';

const state = {
  supabase: null,
  configured: false,
  demoMode: false,
  session: null,
  profile: null,
  profiles: [],
  tickets: [],
  comments: [],
  view: 'kanban',
  filters: {
    search: '',
    statuses: new Set(STATUSES.map((s) => s.id)),
    priorities: new Set(PRIORITIES.map((p) => p.id)),
    horizon: 'all',
  },
  sort: { key: 'updated_at', dir: 'desc' },
  selectedId: null,
  authTab: 'signin',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function cfg() {
  return window.VB_TICKETS_CONFIG || {};
}

function isConfigured() {
  const c = cfg();
  const url = (c.supabaseUrl || '').trim();
  const key = (c.supabaseAnonKey || '').trim();
  if (!url || !key) return false;
  if (url.includes(PLACEHOLDER_URL) || key.includes(PLACEHOLDER_KEY)) return false;
  if (/service.?role/i.test(key)) return false;
  return true;
}

function demoSamples(userId, displayName) {
  const now = Date.now();
  const day = 86400000;
  const mk = (i, t) => ({
    id: `demo-${i}`,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assignee ? userId : null,
    due_at: t.dueOffset == null ? null : new Date(now + t.dueOffset * day).toISOString(),
    tags: t.tags,
    custom_fields: t.custom_fields || {},
    created_by: userId,
    created_at: new Date(now - day).toISOString(),
    updated_at: new Date(now - 3600000).toISOString(),
    _demo: true,
  });
  return [
    mk(1, {
      title: 'Replace brake pads — Unit 12',
      description: 'Front pads worn; schedule bay time.',
      status: 'open',
      priority: 'high',
      assignee: true,
      dueOffset: 3,
      tags: ['fleet', 'maintenance'],
      custom_fields: { unit_number: '12', vehicle: 'F-250', driver: 'M. Reyes' },
    }),
    mk(2, {
      title: 'GPS unit offline — Unit 7',
      description: 'Tracker stopped reporting yesterday evening.',
      status: 'in_progress',
      priority: 'urgent',
      assignee: true,
      dueOffset: -1,
      tags: ['fleet', 'telematics'],
      custom_fields: { unit_number: '7', vehicle: 'Transit', driver: 'A. Chen' },
    }),
    mk(3, {
      title: 'Update SOPs for night dispatch',
      description: 'Draft checklist for after-hours handoff.',
      status: 'blocked',
      priority: 'med',
      assignee: false,
      dueOffset: 14,
      tags: ['ops'],
    }),
    mk(4, {
      title: 'Close Q3 expense audit',
      description: 'All receipts uploaded; awaiting sign-off.',
      status: 'done',
      priority: 'low',
      assignee: true,
      dueOffset: -5,
      tags: ['admin'],
    }),
  ];
}

function profileName(id) {
  if (!id) return '—';
  const p = state.profiles.find((x) => x.id === id);
  if (p) return p.display_name;
  if (state.profile && state.profile.id === id) return state.profile.display_name;
  return 'Unknown';
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtDue(iso) {
  if (!iso) return { text: 'No due', cls: '' };
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);
  const diff = (dueDay - today) / 86400000;
  const text = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff < 0) return { text: `Overdue ${text}`, cls: 'due-overdue' };
  if (diff <= 7) return { text: `Due ${text}`, cls: 'due-soon' };
  return { text: `Due ${text}`, cls: '' };
}

function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label || id;
}
function priorityLabel(id) {
  return PRIORITIES.find((p) => p.id === id)?.label || id;
}

function filteredTickets() {
  const q = state.filters.search.trim().toLowerCase();
  const now = new Date();
  const inDays = (n) => {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() + n);
    return end;
  };
  let list = state.tickets.filter((t) => {
    if (!state.filters.statuses.has(t.status)) return false;
    if (!state.filters.priorities.has(t.priority)) return false;
    if (state.filters.horizon !== 'all') {
      if (!t.due_at) return false;
      const due = new Date(t.due_at);
      if (state.filters.horizon === 'overdue') {
        if (due >= now) return false;
      } else if (state.filters.horizon === '7d') {
        if (due < now || due > inDays(7)) return false;
      } else if (state.filters.horizon === '30d') {
        if (due < now || due > inDays(30)) return false;
      }
    }
    if (q) {
      const hay = [
        t.title, t.description, ...(t.tags || []),
        t.custom_fields?.unit_number, t.custom_fields?.vehicle, t.custom_fields?.driver,
        profileName(t.assignee_id),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  list = [...list].sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'assignee') {
      av = profileName(a.assignee_id);
      bv = profileName(b.assignee_id);
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * mul;
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
  return list;
}

/* ── Init ─────────────────────────────────────────────── */
async function init() {
  state.configured = isConfigured();
  const wantDemo = new URLSearchParams(location.search).has('demo') ||
    sessionStorage.getItem('vb_tickets_demo_ui') === '1';

  if (!state.configured) {
    showConfigBanner(true);
    if (wantDemo) {
      enterDemoPreview();
      return;
    }
    showAuth(true);
    renderAuth();
    wireAuth();
    $('#btn-demo-preview')?.classList.remove('hidden');
    return;
  }

  showConfigBanner(false);
  const c = cfg();
  state.supabase = createClient(c.supabaseUrl, c.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const { data: { session } } = await state.supabase.auth.getSession();
  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (session) {
      await afterSignIn();
    } else {
      state.profile = null;
      state.tickets = [];
      showApp(false);
      showAuth(true);
      renderAuth();
    }
  });

  if (session) {
    state.session = session;
    await afterSignIn();
  } else {
    showAuth(true);
    renderAuth();
  }
  wireAuth();
}

function enterDemoPreview() {
  state.demoMode = true;
  sessionStorage.setItem('vb_tickets_demo_ui', '1');
  state.session = { user: { id: 'demo-user', email: 'demo@local' } };
  state.profile = { id: 'demo-user', display_name: 'Demo preview' };
  state.profiles = [state.profile];
  state.tickets = demoSamples('demo-user', 'Demo preview');
  state._demoCommentsStore = [
    {
      id: 'c1', ticket_id: 'demo-1', author_id: 'demo-user',
      body: 'Parts ordered — ETA Friday.', created_at: new Date().toISOString(),
    },
  ];
  state.comments = state._demoCommentsStore.slice();
  showAuth(false);
  showApp(true);
  $('#demo-banner')?.classList.remove('hidden');
  renderApp();
  wireApp();
}

function showConfigBanner(on) {
  const el = $('#config-banner');
  if (el) el.classList.toggle('hidden', !on);
}

function showAuth(on) {
  $('#auth-gate')?.classList.toggle('hidden', !on);
}
function showApp(on) {
  $('#app-shell')?.classList.toggle('hidden', !on);
}

async function afterSignIn() {
  showAuth(false);
  showApp(true);
  await loadProfile();
  await loadProfiles();
  await loadTickets();
  renderApp();
  wireApp();
}

async function loadProfile() {
  const uid = state.session.user.id;
  const { data, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) console.warn(error);
  if (data) {
    state.profile = data;
  } else {
    const meta = state.session.user.user_metadata || {};
    const dn = meta.display_name || (state.session.user.email || '').split('@')[0] || 'user';
    const { data: inserted } = await state.supabase
      .from('profiles')
      .upsert({ id: uid, display_name: dn })
      .select()
      .single();
    state.profile = inserted || { id: uid, display_name: dn };
  }
}

async function loadProfiles() {
  const { data, error } = await state.supabase.from('profiles').select('*').order('display_name');
  if (error) console.warn(error);
  state.profiles = data || [];
}

async function loadTickets() {
  const { data, error } = await state.supabase
    .from('tickets')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn(error);
    flashError(error.message);
    state.tickets = [];
    return;
  }
  state.tickets = data || [];
}

async function loadComments(ticketId) {
  if (state.demoMode) {
    state.comments = (state.comments || []).filter((c) => c.ticket_id === ticketId)
      .concat((state._allDemoComments || []).filter((c) => c.ticket_id === ticketId));
    // keep simple: filter global demo comments
    state.comments = [
      ...(state._demoCommentsStore || []).filter((c) => c.ticket_id === ticketId),
    ];
    if (!state._demoCommentsStore) {
      state._demoCommentsStore = [
        {
          id: 'c1', ticket_id: 'demo-1', author_id: 'demo-user',
          body: 'Parts ordered — ETA Friday.', created_at: new Date().toISOString(),
        },
      ];
      state.comments = state._demoCommentsStore.filter((c) => c.ticket_id === ticketId);
    }
    return;
  }
  const { data, error } = await state.supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) console.warn(error);
  state.comments = data || [];
}

/* ── Auth UI ──────────────────────────────────────────── */
function wireAuth() {
  $$('.auth-tabs button').forEach((btn) => {
    btn.onclick = () => {
      state.authTab = btn.dataset.tab;
      renderAuth();
    };
  });
  $('#auth-form')?.addEventListener('submit', onAuthSubmit);
  $('#btn-demo-preview')?.addEventListener('click', () => {
    enterDemoPreview();
  });
}

function renderAuth() {
  $$('.auth-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.authTab);
  });
  const signupExtras = $('#signup-extras');
  if (signupExtras) signupExtras.classList.toggle('hidden', state.authTab !== 'signup');
  const submit = $('#auth-submit');
  if (submit) submit.textContent = state.authTab === 'signup' ? 'Create account' : 'Sign in';
  const err = $('#auth-error');
  if (err) { err.textContent = ''; err.classList.add('hidden'); }
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const err = $('#auth-error');
  err?.classList.add('hidden');
  if (!state.configured) {
    if (err) {
      err.textContent = 'Configure config.js with your Supabase URL and anon key first (see HOW-TO.md). Or open Demo preview.';
      err.classList.remove('hidden');
    }
    return;
  }
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const displayName = $('#auth-display-name')?.value.trim();
  const submit = $('#auth-submit');
  if (submit) submit.disabled = true;
  try {
    if (state.authTab === 'signup') {
      if (!displayName) throw new Error('Display name is required.');
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;
      if (data.user && !data.session) {
        if (err) {
          err.textContent = 'Check your email to confirm, then sign in. (Or disable email confirm in Supabase Auth settings for local testing.)';
          err.classList.remove('hidden');
          err.style.color = '#f5d27a';
          err.style.background = 'rgba(240,180,41,0.1)';
          err.style.borderColor = 'rgba(240,180,41,0.35)';
        }
        return;
      }
    } else {
      const { error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (ex) {
    if (err) {
      err.textContent = ex.message || String(ex);
      err.classList.remove('hidden');
      err.style.color = '';
      err.style.background = '';
      err.style.borderColor = '';
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

/* ── App shell ────────────────────────────────────────── */
let appWired = false;
function wireApp() {
  if (appWired) return;
  appWired = true;

  $('#btn-signout')?.addEventListener('click', async () => {
    if (state.demoMode) {
      state.demoMode = false;
      sessionStorage.removeItem('vb_tickets_demo_ui');
      location.href = location.pathname;
      return;
    }
    await state.supabase.auth.signOut();
  });

  $$('.view-toggle button').forEach((b) => {
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      renderApp();
    });
  });

  $('#btn-new')?.addEventListener('click', () => openNewModal());
  $('#btn-export')?.addEventListener('click', exportCsv);
  $('#btn-seed')?.addEventListener('click', seedDemoTickets);
  $('#search')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderBoard();
  });

  $('#filter-status')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const id = chip.dataset.id;
    if (state.filters.statuses.has(id)) state.filters.statuses.delete(id);
    else state.filters.statuses.add(id);
    if (state.filters.statuses.size === 0) {
      STATUSES.forEach((s) => state.filters.statuses.add(s.id));
    }
    renderFilters();
    renderBoard();
  });

  $('#filter-priority')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const id = chip.dataset.id;
    if (state.filters.priorities.has(id)) state.filters.priorities.delete(id);
    else state.filters.priorities.add(id);
    if (state.filters.priorities.size === 0) {
      PRIORITIES.forEach((p) => state.filters.priorities.add(p.id));
    }
    renderFilters();
    renderBoard();
  });

  $('#filter-horizon')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filters.horizon = chip.dataset.id;
    renderFilters();
    renderBoard();
  });

  $('#drawer-close')?.addEventListener('click', closeDrawer);
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer);
  $('#drawer-save')?.addEventListener('click', saveDrawer);
  $('#drawer-delete')?.addEventListener('click', deleteSelected);
  $('#comment-form')?.addEventListener('submit', addComment);

  $('#new-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'new-modal-backdrop') closeNewModal();
  });
  $('#new-cancel')?.addEventListener('click', closeNewModal);
  $('#new-form')?.addEventListener('submit', createTicket);
}

function renderApp() {
  const name = state.profile?.display_name || state.session?.user?.email || 'User';
  const chip = $('#user-chip');
  if (chip) chip.textContent = name;
  $$('.view-toggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === state.view);
  });
  const seedBtn = $('#btn-seed');
  if (seedBtn) seedBtn.classList.toggle('hidden', state.demoMode);
  renderFilters();
  renderBoard();
}

function renderFilters() {
  const st = $('#filter-status');
  if (st) {
    st.innerHTML = STATUSES.map((s) =>
      `<button type="button" class="chip ${state.filters.statuses.has(s.id) ? 'on' : ''}" data-id="${s.id}">${s.label}</button>`
    ).join('');
  }
  const pr = $('#filter-priority');
  if (pr) {
    pr.innerHTML = PRIORITIES.map((p) =>
      `<button type="button" class="chip pri-${p.id} ${state.filters.priorities.has(p.id) ? 'on' : ''}" data-id="${p.id}">${p.label}</button>`
    ).join('');
  }
  const hz = $('#filter-horizon');
  if (hz) {
    hz.innerHTML = HORIZONS.map((h) =>
      `<button type="button" class="chip ${state.filters.horizon === h.id ? 'on' : ''}" data-id="${h.id}">${h.label}</button>`
    ).join('');
  }
}

function renderBoard() {
  const list = filteredTickets();
  const kanban = $('#kanban');
  const tableWrap = $('#table-wrap');
  const empty = $('#empty-state');
  if (state.view === 'kanban') {
    kanban?.classList.remove('hidden');
    tableWrap?.classList.add('hidden');
    renderKanban(list);
  } else {
    kanban?.classList.add('hidden');
    tableWrap?.classList.remove('hidden');
    renderTable(list);
  }
  if (empty) {
    const show = list.length === 0;
    empty.classList.toggle('hidden', !show);
    if (show) {
      empty.innerHTML = `
        <h3>No tickets match</h3>
        <p>Adjust filters, create a ticket, or load demo sample tickets for your account.</p>
        <button type="button" class="btn btn-primary" id="empty-new">New ticket</button>
        ${state.demoMode ? '' : '<button type="button" class="btn" id="empty-seed">Load demo tickets</button>'}
      `;
      $('#empty-new')?.addEventListener('click', openNewModal);
      $('#empty-seed')?.addEventListener('click', seedDemoTickets);
    }
  }
}

function renderKanban(list) {
  const root = $('#kanban');
  if (!root) return;
  root.innerHTML = STATUSES.map((s) => {
    const cards = list.filter((t) => t.status === s.id);
    return `
      <section class="column" data-status="${s.id}">
        <div class="column-head">
          <h2>${s.label}</h2>
          <span class="count">${cards.length}</span>
        </div>
        <div class="column-body">
          ${cards.map(cardHtml).join('') || '<p style="color:var(--text-dim);font-size:0.8rem;padding:8px;">Empty</p>'}
        </div>
      </section>`;
  }).join('');
  $$('.ticket-card', root).forEach((el) => {
    el.addEventListener('click', () => openDrawer(el.dataset.id));
  });
}

function cardHtml(t) {
  const due = fmtDue(t.due_at);
  return `
    <article class="ticket-card" data-id="${t.id}" tabindex="0" role="button">
      <div class="title">${escapeHtml(t.title)}</div>
      <div class="ticket-meta">
        <span class="badge pri-${t.priority}">${priorityLabel(t.priority)}</span>
        <span>${escapeHtml(profileName(t.assignee_id))}</span>
        <span class="${due.cls}">${due.text}</span>
      </div>
    </article>`;
}

function renderTable(list) {
  const body = $('#table-body');
  const head = $('#table-head');
  if (!body || !head) return;
  const cols = [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'due_at', label: 'Due' },
    { key: 'updated_at', label: 'Updated' },
  ];
  head.innerHTML = `<tr>${cols.map((c) =>
    `<th data-key="${c.key}">${c.label}${state.sort.key === c.key ? (state.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`
  ).join('')}</tr>`;
  $$('th', head).forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.key = key; state.sort.dir = 'asc'; }
      renderBoard();
    });
  });
  body.innerHTML = list.map((t) => {
    const due = fmtDue(t.due_at);
    return `<tr data-id="${t.id}">
      <td>${escapeHtml(t.title)}</td>
      <td>${statusLabel(t.status)}</td>
      <td><span class="badge pri-${t.priority}">${priorityLabel(t.priority)}</span></td>
      <td>${escapeHtml(profileName(t.assignee_id))}</td>
      <td class="${due.cls}">${due.text}</td>
      <td>${fmtDate(t.updated_at)}</td>
    </tr>`;
  }).join('');
  $$('tr', body).forEach((tr) => {
    tr.addEventListener('click', () => openDrawer(tr.dataset.id));
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Drawer ───────────────────────────────────────────── */
async function openDrawer(id) {
  state.selectedId = id;
  const t = state.tickets.find((x) => x.id === id);
  if (!t) return;
  await loadComments(id);
  $('#drawer-backdrop')?.classList.remove('hidden');
  $('#drawer')?.classList.remove('hidden');
  $('#drawer-title').textContent = t.title;
  fillTicketForm($('#drawer-form'), t);
  renderComments();
}

function closeDrawer() {
  state.selectedId = null;
  $('#drawer-backdrop')?.classList.add('hidden');
  $('#drawer')?.classList.add('hidden');
}

function fillTicketForm(form, t) {
  if (!form) return;
  form.title.value = t?.title || '';
  form.description.value = t?.description || '';
  form.status.value = t?.status || 'open';
  form.priority.value = t?.priority || 'med';
  form.assignee_id.innerHTML = `<option value="">Unassigned</option>` +
    state.profiles.map((p) =>
      `<option value="${p.id}" ${t?.assignee_id === p.id ? 'selected' : ''}>${escapeHtml(p.display_name)}</option>`
    ).join('');
  form.due_at.value = t?.due_at ? toLocalInput(t.due_at) : '';
  form.tags.value = (t?.tags || []).join(', ');
  const cf = t?.custom_fields || {};
  form.unit_number.value = cf.unit_number || '';
  form.vehicle.value = cf.vehicle || '';
  form.driver.value = cf.driver || '';
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readTicketForm(form) {
  const tags = form.tags.value.split(',').map((s) => s.trim()).filter(Boolean);
  const custom_fields = {
    unit_number: form.unit_number.value.trim() || null,
    vehicle: form.vehicle.value.trim() || null,
    driver: form.driver.value.trim() || null,
  };
  Object.keys(custom_fields).forEach((k) => {
    if (custom_fields[k] == null) delete custom_fields[k];
  });
  return {
    title: form.title.value.trim(),
    description: form.description.value.trim() || null,
    status: form.status.value,
    priority: form.priority.value,
    assignee_id: form.assignee_id.value || null,
    due_at: form.due_at.value ? new Date(form.due_at.value).toISOString() : null,
    tags,
    custom_fields,
  };
}

function renderComments() {
  const list = $('#comments-list');
  if (!list) return;
  if (!state.comments.length) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No comments yet.</p>';
    return;
  }
  list.innerHTML = state.comments.map((c) => `
    <div class="comment">
      <div class="meta"><strong>${escapeHtml(profileName(c.author_id))}</strong><span>${fmtDate(c.created_at)}</span></div>
      <div>${escapeHtml(c.body)}</div>
    </div>`).join('');
}

async function saveDrawer() {
  const form = $('#drawer-form');
  const payload = readTicketForm(form);
  if (!payload.title) return flashError('Title is required.');
  if (state.demoMode) {
    const t = state.tickets.find((x) => x.id === state.selectedId);
    Object.assign(t, payload, { updated_at: new Date().toISOString() });
    renderBoard();
    $('#drawer-title').textContent = t.title;
    return;
  }
  const { error } = await state.supabase.from('tickets').update(payload).eq('id', state.selectedId);
  if (error) return flashError(error.message);
  await loadTickets();
  renderBoard();
  const t = state.tickets.find((x) => x.id === state.selectedId);
  if (t) $('#drawer-title').textContent = t.title;
}

async function deleteSelected() {
  if (!state.selectedId) return;
  if (!confirm('Delete this ticket?')) return;
  if (state.demoMode) {
    state.tickets = state.tickets.filter((t) => t.id !== state.selectedId);
    closeDrawer();
    renderBoard();
    return;
  }
  const { error } = await state.supabase.from('tickets').delete().eq('id', state.selectedId);
  if (error) return flashError(error.message);
  closeDrawer();
  await loadTickets();
  renderBoard();
}

async function addComment(e) {
  e.preventDefault();
  const input = $('#comment-body');
  const body = input.value.trim();
  if (!body || !state.selectedId) return;
  if (state.demoMode) {
    if (!state._demoCommentsStore) state._demoCommentsStore = [];
    state._demoCommentsStore.push({
      id: `c-${Date.now()}`,
      ticket_id: state.selectedId,
      author_id: state.profile.id,
      body,
      created_at: new Date().toISOString(),
    });
    state.comments = state._demoCommentsStore.filter((c) => c.ticket_id === state.selectedId);
    input.value = '';
    renderComments();
    return;
  }
  const { error } = await state.supabase.from('comments').insert({
    ticket_id: state.selectedId,
    author_id: state.profile.id,
    body,
  });
  if (error) return flashError(error.message);
  input.value = '';
  await loadComments(state.selectedId);
  renderComments();
}

/* ── New ticket modal ─────────────────────────────────── */
function openNewModal() {
  const backdrop = $('#new-modal-backdrop');
  backdrop?.classList.remove('hidden');
  const form = $('#new-form');
  fillTicketForm(form, {
    title: '', description: '', status: 'open', priority: 'med',
    assignee_id: state.profile?.id || null, due_at: null, tags: [], custom_fields: {},
  });
  form.title.focus();
}
function closeNewModal() {
  $('#new-modal-backdrop')?.classList.add('hidden');
}

async function createTicket(e) {
  e.preventDefault();
  const form = $('#new-form');
  const payload = readTicketForm(form);
  if (!payload.title) return flashError('Title is required.');
  if (state.demoMode) {
    const t = {
      id: `demo-${Date.now()}`,
      ...payload,
      created_by: state.profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _demo: true,
    };
    state.tickets.unshift(t);
    closeNewModal();
    renderBoard();
    return;
  }
  const { error } = await state.supabase.from('tickets').insert({
    ...payload,
    created_by: state.profile.id,
  });
  if (error) return flashError(error.message);
  closeNewModal();
  await loadTickets();
  renderBoard();
}

/* ── Demo seed (real DB via anon+RLS) ─────────────────── */
async function seedDemoTickets() {
  if (state.demoMode) return;
  if (!state.configured || !state.session) return flashError('Sign in with Supabase configured first.');
  const uid = state.profile.id;
  const samples = demoSamples(uid).map(({ id, _demo, ...rest }) => ({
    ...rest,
    created_by: uid,
  }));
  const { error } = await state.supabase.from('tickets').insert(samples);
  if (error) return flashError(error.message);
  await loadTickets();
  renderBoard();
}

/* ── CSV export (filtered view, client-side) ──────────── */
function exportCsv() {
  const list = filteredTickets();
  const headers = [
    'id', 'title', 'description', 'status', 'priority', 'assignee',
    'due_at', 'tags', 'unit_number', 'vehicle', 'driver', 'created_at', 'updated_at',
  ];
  const rows = list.map((t) => [
    t.id, t.title, t.description || '', t.status, t.priority,
    profileName(t.assignee_id), t.due_at || '',
    (t.tags || []).join(';'),
    t.custom_fields?.unit_number || '',
    t.custom_fields?.vehicle || '',
    t.custom_fields?.driver || '',
    t.created_at || '', t.updated_at || '',
  ]);
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function flashError(msg) {
  const el = $('#flash-error');
  if (!el) { console.error(msg); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(flashError._t);
  flashError._t = setTimeout(() => el.classList.add('hidden'), 5000);
}

init().catch((e) => {
  console.error(e);
  flashError(e.message || String(e));
});
