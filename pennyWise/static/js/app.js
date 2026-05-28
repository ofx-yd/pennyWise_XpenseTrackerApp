// ─── CONFIG ─────────────────────────────────────────────────
const API_BASE = 'http://localhost';

// ─── STATE ──────────────────────────────────────────────────
// API data cached in memory — never persisted to localStorage
let _accounts        = [];   // [{ id, name, balance }]
let _incomeCategories  = []; // [{ id, name }]
let _expenseCategories = []; // [{ id, name }]
let _incomeRecords   = [];   // from GET /income
let _expenseRecords  = [];   // from GET /expenses
let _transferRecords = [];   // from GET /transfers
let _debts           = [];   // from GET /debts
let _currentUser     = null; // { id, username }

// localStorage-only (planning features not yet on API)
let budgets     = JSON.parse(localStorage.getItem('budgets'))     || [];
let savingsGoals = JSON.parse(localStorage.getItem('savingsGoals')) || [];

let txType  = 'income';
let txType2 = 'income';
let incomeChart, expenseChart;
let _pendingExpense = null;

// ─── HELPERS ────────────────────────────────────────────────
function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function fmt(n) { return parseFloat(n || 0).toFixed(2); }
function today() { return new Date().toISOString().slice(0, 10); }

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ─── INIT ────────────────────────────────────────────────────
async function initApp() {
  const { ok, data } = await api('/check-auth');
  if (!ok || !data.user) {
    window.location.href = 'login.html';
    return;
  }

  _currentUser = data.user;
  const uname    = _currentUser.username || 'User';
  const initials = uname.slice(0, 2).toUpperCase();

  ['userAvatar', 'topbarAvatar', 'menuAvatar'].forEach(id => setEl(id, initials));
  ['userName', 'topbarName', 'menuName'].forEach(id => setEl(id, uname));
  ['userEmailDisplay', 'menuEmail'].forEach(id => setEl(id, '—'));

  // Load all data in parallel
  await Promise.all([
    loadAccounts(),
    loadIncomeCategories(),
    loadExpenseCategories(),
    loadDebts(),
  ]);

  await Promise.all([
    loadIncomeRecords(),
    loadExpenseRecords(),
    loadTransferRecords(),
  ]);

  render();
  renderDashWidgets();

  document.getElementById('date').value  = today();
  document.getElementById('date2').value = today();
  document.getElementById('tfDate').value = today();
  document.getElementById('monthFilter').addEventListener('change', () => {
    renderIncomeSection();
    renderExpenseSection();
    render();
    updateCharts();
  });
}

// ─── DATA LOADERS ────────────────────────────────────────────
async function loadAccounts() {
  const { ok, data } = await api('/accounts');
  if (ok) {
    _accounts = data.data || [];
    populateAccountDropdowns();
    renderAccountsSection();
    renderAccountStrip();
  }
}

async function loadIncomeCategories() {
  const { ok, data } = await api('/income-categories');
  if (ok) _incomeCategories = data.data || [];
}

async function loadExpenseCategories() {
  const { ok, data } = await api('/expense-categories');
  if (ok) _expenseCategories = data.data || [];
}

async function loadIncomeRecords() {
  const { ok, data } = await api('/income');
  if (ok) _incomeRecords = data.data || [];
}

async function loadExpenseRecords() {
  const { ok, data } = await api('/expenses');
  if (ok) _expenseRecords = data.data || [];
}

async function loadTransferRecords() {
  const { ok, data } = await api('/transfers');
  if (ok) _transferRecords = data.data || [];
}

async function loadDebts() {
  const { ok, data } = await api('/debts');
  if (ok) _debts = data.data || [];
}

// ─── ACCOUNT DROPDOWNS ───────────────────────────────────────
function populateAccountDropdowns() {
  const selects = ['quickAccount', 'account2', 'tfFrom', 'tfTo'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = _accounts.length
      ? _accounts.map(a => `<option value="${a.id}">${a.name} ($${fmt(a.balance)})</option>`).join('')
      : '<option value="">No accounts — create one first</option>';
    // Restore selection if still valid
    if (current && [...el.options].some(o => o.value === current)) el.value = current;
  });
}

// ─── CATEGORY DROPDOWNS ──────────────────────────────────────
function loadCategories() {
  const cats = txType === 'income' ? _incomeCategories : _expenseCategories;
  const el = document.getElementById('category');
  el.innerHTML = cats.length
    ? '<option value="">Select…</option>' + cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
    : '<option value="">No categories — add one first</option>';
}

function loadCategories2() {
  const cats = txType2 === 'income' ? _incomeCategories : _expenseCategories;
  const el = document.getElementById('category2');
  el.innerHTML = cats.length
    ? '<option value="">Select…</option>' + cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
    : '<option value="">No categories — add one first</option>';
}

// ─── NAVIGATION UTILITIES ───────────────────────────────────
function setType(t) {
  txType = t;
  document.getElementById('incomeBtn').classList.toggle('active', t === 'income');
  document.getElementById('expenseBtn').classList.toggle('active', t === 'expense');
  loadCategories();
}

// ─── FORM SETTERS & SUBMITTERS ────────────────────────────────
function setType2(t) {
  txType2 = t;
  document.getElementById('incomeBtn2').classList.toggle('active', t === 'income');
  document.getElementById('expenseBtn2').classList.toggle('active', t === 'expense');
  loadCategories2();
}

// ─── MONTH FILTER ─────────────────────────────────────────────
function getMonthFilter() {
  return document.getElementById('monthFilter').value; // e.g. "2026-05" or ""
}

function filterByMonth(records) {
  const m = getMonthFilter();
  if (!m) return records;
  return records.filter(r => r.date && r.date.startsWith(m));
}

// ─── ACCOUNT STRIP (dashboard mini cards) ────────────────────
function renderAccountStrip() {
  const strip = document.getElementById('accountStrip');
  const total = _accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
  setEl('totalBal', '$' + fmt(total));

  // Remove old dynamic cards, keep the Net Worth card
  strip.querySelectorAll('.acc-mini:not(.total-acc)').forEach(el => el.remove());

  _accounts.forEach(a => {
    const div = document.createElement('div');
    div.className = 'acc-mini';
    div.style.cursor = 'pointer';
    div.onclick = () => navTo('accounts');
    div.innerHTML = `
      <div class="acc-mini-icon"><i class="fa-solid fa-building-columns"></i></div>
      <div class="acc-mini-info">
        <div class="acc-mini-name">${a.name}</div>
        <div class="acc-mini-bal">$${fmt(a.balance)}</div>
      </div>`;
    // Insert before the Net Worth card
    strip.insertBefore(div, strip.querySelector('.total-acc'));
  });
}

// ─── ACCOUNTS SECTION ────────────────────────────────────────
function renderAccountsSection() {
  const grid  = document.getElementById('accounts-grid');
  const empty = document.getElementById('accounts-empty');
  const total = _accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  setEl('accountsTotalBal', '$' + fmt(total));
  setEl('accountsCount', _accounts.length);

  if (!_accounts.length) {
    grid.innerHTML  = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = _accounts.map(a => `
    <div class="account-full-card">
      <div class="acf-header">
        <div class="acf-icon"><i class="fa-solid fa-building-columns"></i></div>
        <div>
          <div class="acf-name">${a.name}</div>
          <div class="acf-sub">Account #${a.id}</div>
        </div>
        <div class="acf-actions" style="margin-left:auto;display:flex;gap:8px">
          <button class="action-btn" onclick="openEditAccountModal(${a.id},'${a.name}',${a.balance})" title="Rename"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn del" onclick="deleteAccount(${a.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="acf-balance">$${fmt(a.balance)}</div>
      <div class="acf-stats">
        <div>
          <div class="acf-stat-label">Income</div>
          <div class="acf-stat-val green">$${fmt(_incomeRecords.filter(r => r.account === a.name).reduce((s,r) => s + parseFloat(r.amount||0), 0))}</div>
        </div>
        <div>
          <div class="acf-stat-label">Expenses</div>
          <div class="acf-stat-val red">$${fmt(_expenseRecords.filter(r => r.account === a.name).reduce((s,r) => s + parseFloat(r.amount||0), 0))}</div>
        </div>
      </div>
      <button class="btn-add" style="width:100%;margin-top:16px" onclick="openTxModal('income',null,${a.id})">
        <i class="fa-solid fa-plus"></i> Add Transaction
      </button>
    </div>`).join('');
}

// ─── CREATE ACCOUNT ───────────────────────────────────────────
document.getElementById('createAccountForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name    = document.getElementById('newAccountName').value.trim();
  const balance = parseFloat(document.getElementById('newAccountBalance').value) || 0;
  if (!name) { showToast('Account name is required', 'error'); return; }

  const { ok, data } = await api('/accounts', {
    method: 'POST',
    body: JSON.stringify({ name, balance }),
  });

  if (ok) {
    showToast(`Account "${name}" created`);
    document.getElementById('newAccountName').value    = '';
    document.getElementById('newAccountBalance').value = '0';
    await loadAccounts();
  } else {
    showToast(data.message || 'Could not create account', 'error');
  }
});

// ─── EDIT ACCOUNT ─────────────────────────────────────────────
function openEditAccountModal(id, name, balance) {
  openModal('Edit Account', `
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">Account Name</label>
      <input type="text" id="editAccName" class="form-input" value="${name}">
    </div>
    <div class="form-group" style="margin-bottom:20px">
      <label class="form-label">Balance ($)</label>
      <input type="number" id="editAccBalance" class="form-input" value="${balance}" step="0.01" min="0">
    </div>
    <button class="btn-submit" onclick="submitEditAccount(${id})">Save Changes</button>
  `);
}

async function submitEditAccount(id) {
  const name    = document.getElementById('editAccName').value.trim();
  const balance = parseFloat(document.getElementById('editAccBalance').value);
  if (!name) { showToast('Name is required', 'error'); return; }

  const { ok, data } = await api(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, balance }),
  });

  if (ok) {
    showToast('Account updated');
    closeModal();
    await loadAccounts();
    await Promise.all([loadIncomeRecords(), loadExpenseRecords()]);
    renderIncomeSection();
    renderExpenseSection();
  } else {
    showToast(data.message || 'Could not update account', 'error');
  }
}

// ─── DELETE ACCOUNT ───────────────────────────────────────────
async function deleteAccount(id) {
  const acc = _accounts.find(a => a.id === id);
  if (!confirm(`Delete account "${acc?.name}"? This cannot be undone.`)) return;

  const { ok, data } = await api(`/accounts/${id}`, { method: 'DELETE' });
  if (ok) {
    showToast('Account deleted');
    await loadAccounts();
  } else {
    showToast(data.message || 'Could not delete account', 'error');
  }
}

// ─── TRANSFER ────────────────────────────────────────────────
async function submitAccountTransfer() {
  const fromId = parseInt(document.getElementById('tfFrom').value);
  const toId   = parseInt(document.getElementById('tfTo').value);
  const amount = parseFloat(document.getElementById('tfAmount').value);
  const date   = document.getElementById('tfDate').value;
  const desc   = document.getElementById('tfNote').value.trim();

  if (!fromId || !toId)  { showToast('Select both accounts', 'error'); return; }
  if (fromId === toId)   { showToast('Choose different accounts', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!date)             { showToast('Choose a date', 'error'); return; }

  const { ok, data } = await api('/transfers', {
    method: 'POST',
    body: JSON.stringify({ from_account_id: fromId, to_account_id: toId, amount, date, description: desc }),
  });

  if (ok) {
    showToast(`Transferred $${fmt(amount)}`);
    document.getElementById('tfAmount').value = '';
    document.getElementById('tfNote').value   = '';
    await loadAccounts();
    await loadTransferRecords();
    renderTransferSection();
  } else {
    showToast(data.message || 'Transfer failed', 'error');
  }
}

// ─── TRANSACTION MODAL ────────────────────────────────────────
async function openTxModal(type, existing, defaultAccId) {
  const cats = type === 'income' ? _incomeCategories : _expenseCategories;
  const accVal = existing?.account_id || defaultAccId || (_accounts[0]?.id || '');

  const accOptions = _accounts.map(a =>
    `<option value="${a.id}" ${a.id == accVal ? 'selected' : ''}>${a.name}</option>`
  ).join('');

  const catOptions = cats.map(c =>
    `<option value="${c.id}" ${existing?.category == c.name ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const html = `
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">Description</label>
      <input id="txDesc" class="form-input" value="${existing?.description || ''}" placeholder="e.g. Grocery run" required>
    </div>
    <div class="form-grid" style="margin-bottom:14px">
      <div class="form-group">
        <label class="form-label">Amount ($)</label>
        <input id="txAmount" type="number" class="form-input" value="${existing ? fmt(existing.amount) : ''}" placeholder="0.00" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input id="txDate" type="date" class="form-input" value="${existing?.date || today()}" required>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">Account</label>
      <select id="txAccount" class="form-input">${accOptions}</select>
    </div>
    <div class="form-group" style="margin-bottom:20px">
      <label class="form-label">Category</label>
      <select id="txCategory" class="form-input">
        <option value="">Select…</option>${catOptions}
      </select>
    </div>
    <button class="btn-submit" onclick="submitTx('${type}',${existing ? existing.id : 'null'})">
      ${existing ? 'Save Changes' : (type === 'income' ? 'Add Income' : 'Add Expense')}
    </button>`;

  openModal((existing ? 'Edit ' : 'Add ') + (type === 'income' ? 'Income' : 'Expense'), html);
}

async function submitTx(type, editId) {
  const desc       = document.getElementById('txDesc').value.trim();
  const amount     = parseFloat(document.getElementById('txAmount').value);
  const date       = document.getElementById('txDate').value;
  const account_id = parseInt(document.getElementById('txAccount').value);
  const category_id = parseInt(document.getElementById('txCategory').value);

  if (!desc || !amount || !date || !account_id || !category_id) {
    showToast('Fill all fields', 'error'); return;
  }

  const endpoint = type === 'income' ? '/income' : '/expenses';
  const method   = editId ? 'PUT' : 'POST';
  const path     = editId ? `${endpoint}/${editId}` : endpoint;

  const { ok, data } = await api(path, {
    method,
    body: JSON.stringify({ description: desc, amount, date, account_id, category_id }),
  });

  if (ok) {
    showToast(editId ? 'Updated!' : 'Added!');
    closeModal();
    await loadAccounts();
    if (type === 'income') {
      await loadIncomeRecords();
      renderIncomeSection();
    } else {
      await loadExpenseRecords();
      renderExpenseSection();
    }
    render();
  } else {
    showToast(data.message || 'Could not save', 'error');
  }
}

// ─── DELETE TX ────────────────────────────────────────────────
async function deleteTx(type, id) {
  const endpoint = type === 'income' ? `/income/${id}` : `/expenses/${id}`;
  const { ok, data } = await api(endpoint, { method: 'DELETE' });

  if (ok) {
    showToast('Deleted');
    await loadAccounts();
    if (type === 'income') { await loadIncomeRecords(); renderIncomeSection(); }
    else                   { await loadExpenseRecords(); renderExpenseSection(); }
    render();
  } else {
    showToast(data.message || 'Could not delete', 'error');
  }
}

// ─── DELETE TRANSFER ─────────────────────────────────────────
async function deleteTransferRecord(id) {
  const { ok, data } = await api(`/transfers/${id}`, { method: 'DELETE' });
  if (ok) {
    showToast('Transfer deleted');
    await loadAccounts();
    await loadTransferRecords();
    renderTransferSection();
  } else {
    showToast(data.message || 'Could not delete transfer', 'error');
  }
}

// ─── QUICK ADD FORM ───────────────────────────────────────────
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const desc        = document.getElementById('text').value.trim();
  const amount      = parseFloat(document.getElementById('amount').value);
  const date        = document.getElementById('date').value;
  const account_id  = parseInt(document.getElementById('quickAccount').value);
  const category_id = parseInt(document.getElementById('category').value);

  if (!desc || !amount || !date || !account_id || !category_id) {
    showToast('Fill all fields', 'error'); return;
  }

  const endpoint = txType === 'income' ? '/income' : '/expenses';
  const { ok, data } = await api(endpoint, {
    method: 'POST',
    body: JSON.stringify({ description: desc, amount, date, account_id, category_id }),
  });

  if (ok) {
    showToast('Added!');
    document.getElementById('form').reset();
    document.getElementById('date').value = today();
    setType('income');
    await loadAccounts();
    if (txType === 'income') { await loadIncomeRecords(); }
    else                     { await loadExpenseRecords(); }
    render();
  } else {
    showToast(data.message || 'Could not add', 'error');
  }
});

// ─── ADD TRANSACTION FORM (section-add) ──────────────────────
document.getElementById('form2').addEventListener('submit', async e => {
  e.preventDefault();
  const desc        = document.getElementById('text2').value.trim();
  const amount      = parseFloat(document.getElementById('amount2').value);
  const date        = document.getElementById('date2').value;
  const account_id  = parseInt(document.getElementById('account2').value);
  const category_id = parseInt(document.getElementById('category2').value);

  if (!desc || !amount || !date || !account_id || !category_id) {
    showToast('Fill all fields', 'error'); return;
  }

  const endpoint = txType2 === 'income' ? '/income' : '/expenses';
  const { ok, data } = await api(endpoint, {
    method: 'POST',
    body: JSON.stringify({ description: desc, amount, date, account_id, category_id }),
  });

  if (ok) {
    showToast('Added!');
    document.getElementById('form2').reset();
    document.getElementById('date2').value = today();
    setType2('income');
    await loadAccounts();
    if (txType2 === 'income') { await loadIncomeRecords(); renderIncomeSection(); }
    else                      { await loadExpenseRecords(); renderExpenseSection(); }
    render();
  } else {
    showToast(data.message || 'Could not add', 'error');
  }
});

// ─── CATEGORIES ──────────────────────────────────────────────
async function addCategory(type) {
  const inputId = type === 'income' ? 'newIncomeCategory' : 'newExpenseCategory';
  const name    = document.getElementById(inputId).value.trim();
  if (!name) return;

  const endpoint = type === 'income' ? '/income-categories' : '/expense-categories';
  const { ok, data } = await api(endpoint, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  if (ok) {
    showToast(`"${name}" added`);
    document.getElementById(inputId).value = '';
    if (type === 'income') await loadIncomeCategories();
    else                   await loadExpenseCategories();
    renderCategoryChips();
    loadCategories();
    loadCategories2();
  } else {
    showToast(data.message || 'Could not add category', 'error');
  }
}

async function deleteCategory(id, type) {
  const endpoint = type === 'income' ? `/income-categories/${id}` : `/expense-categories/${id}`;
  const { ok, data } = await api(endpoint, { method: 'DELETE' });

  if (ok) {
    showToast('Category removed');
    if (type === 'income') await loadIncomeCategories();
    else                   await loadExpenseCategories();
    renderCategoryChips();
    loadCategories();
    loadCategories2();
  } else {
    showToast(data.message || 'Could not delete category', 'error');
  }
}

// ─── LOCAL STORAGE WRAPPER FOR PLANNING ──────────────────────
function saveLocal() {
  localStorage.setItem('budgets',      JSON.stringify(budgets));
  localStorage.setItem('savingsGoals', JSON.stringify(savingsGoals));
}

function renderCategoryChips() {
  const ie = document.getElementById('incomeCategoryChips');
  const ee = document.getElementById('expenseCategoryChips');

  ie.innerHTML = _incomeCategories.length
    ? _incomeCategories.map(c => `
        <div class="cat-chip">
          ${c.name}
          <button class="cat-chip-del" onclick="deleteCategory(${c.id},'income')">✕</button>
        </div>`).join('')
    : '<div style="color:var(--text-muted);font-size:13px">No income categories yet</div>';

  ee.innerHTML = _expenseCategories.length
    ? _expenseCategories.map(c => `
        <div class="cat-chip">
          ${c.name}
          <button class="cat-chip-del" onclick="deleteCategory(${c.id},'expense')">✕</button>
        </div>`).join('')
    : '<div style="color:var(--text-muted);font-size:13px">No expense categories yet</div>';
}

// ─── INCOME SECTION ───────────────────────────────────────────
function renderIncomeSection() {
  const data  = filterByMonth(_incomeRecords);
  const tbody = document.getElementById('income-tbody');
  const total = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  setEl('incomeTotal', '$' + fmt(total));
  setEl('incomeCount', data.length);

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.description || '—'}</td>
      <td><span class="badge-acc">${r.account || '—'}</span></td>
      <td><span class="badge-cat income-tag">${r.category || '—'}</span></td>
      <td style="color:var(--green);font-weight:600">+$${fmt(r.amount)}</td>
      <td style="color:var(--text-muted)">${r.date}</td>
      <td class="td-actions">
        <button class="action-btn" onclick="openTxModal('income',${JSON.stringify(r).replace(/"/g,'&quot;')})">✎</button>
        <button class="action-btn del" onclick="deleteTx('income',${r.id})">✕</button>
      </td>
    </tr>`).join('');

  document.getElementById('income-empty').style.display = data.length ? 'none' : 'block';
}

// ─── EXPENSE SECTION ──────────────────────────────────────────
function renderExpenseSection() {
  const data  = filterByMonth(_expenseRecords);
  const tbody = document.getElementById('expense-tbody');
  const total = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  setEl('expenseTotal', '$' + fmt(total));
  setEl('expenseCount', data.length);

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.description || '—'}</td>
      <td><span class="badge-acc">${r.account || '—'}</span></td>
      <td><span class="badge-cat expense-tag">${r.category || '—'}</span></td>
      <td style="color:var(--red);font-weight:600">−$${fmt(r.amount)}</td>
      <td style="color:var(--text-muted)">${r.date}</td>
      <td class="td-actions">
        <button class="action-btn" onclick="openTxModal('expense',${JSON.stringify(r).replace(/"/g,'&quot;')})">✎</button>
        <button class="action-btn del" onclick="deleteTx('expense',${r.id})">✕</button>
      </td>
    </tr>`).join('');

  document.getElementById('expense-empty').style.display = data.length ? 'none' : 'block';
}

// ─── TRANSFER SECTION ─────────────────────────────────────────
function renderTransferSection() {
  const tbody = document.getElementById('transfer-tbody');
  const total = _transferRecords.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  setEl('transferTotal', '$' + fmt(total));
  setEl('transferCount', _transferRecords.length);

  tbody.innerHTML = _transferRecords.map(r => `
    <tr>
      <td>${r.description || '—'}</td>
      <td><span class="badge-acc">${r.from_account || '—'}</span></td>
      <td><span class="badge-acc">${r.to_account || '—'}</span></td>
      <td style="color:var(--blue);font-weight:600">$${fmt(r.amount)}</td>
      <td style="color:var(--text-muted)">${r.date || '—'}</td>
      <td class="td-actions">
        <button class="action-btn del" onclick="deleteTransferRecord(${r.id})">✕</button>
      </td>
    </tr>`).join('');

  document.getElementById('transfer-empty').style.display = _transferRecords.length ? 'none' : 'block';
}

// ─── MAIN RENDER (dashboard) ──────────────────────────────────
const ICONS = {
  Salary:'<i class="fa-solid fa-briefcase"></i>', Business:'<i class="fa-solid fa-building"></i>',
  Investment:'<i class="fa-solid fa-chart-line"></i>', Freelance:'<i class="fa-solid fa-laptop-code"></i>',
  Bonus:'<i class="fa-solid fa-gift"></i>', Food:'<i class="fa-solid fa-utensils"></i>',
  Transport:'<i class="fa-solid fa-car"></i>', Entertainment:'<i class="fa-solid fa-film"></i>',
  Bills:'<i class="fa-solid fa-file-invoice"></i>', Shopping:'<i class="fa-solid fa-bag-shopping"></i>',
  Health:'<i class="fa-solid fa-heart-pulse"></i>', Transfer:'<i class="fa-solid fa-right-left"></i>',
};
function catIcon(cat) { return ICONS[cat] || '<i class="fa-solid fa-circle-dot"></i>'; }

function render() {
  const incFiltered = filterByMonth(_incomeRecords);
  const expFiltered = filterByMonth(_expenseRecords);

  const totalInc = incFiltered.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalExp = expFiltered.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const netBal   = _accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  setEl('balance',  fmt(netBal));
  setEl('balance2', fmt(netBal));
  setEl('income',   fmt(totalInc));
  setEl('income2',  fmt(totalInc));
  setEl('expense',  fmt(totalExp));
  setEl('expense2', fmt(totalExp));

  // Combine income and expense for recent list, sorted by date desc
  const combined = [
    ...incFiltered.map(r => ({ ...r, _type: 'income' })),
    ...expFiltered.map(r => ({ ...r, _type: 'expense' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const list = document.getElementById('list');
  list.innerHTML = combined.map(r => `
    <div class="tx-item ${r._type === 'income' ? 'plus' : 'minus'}">
      <div class="tx-icon">${catIcon(r.category)}</div>
      <div class="tx-info">
        <div class="tx-name">${r.description || '—'}</div>
        <div class="tx-meta">${r.account || '—'} · ${r.category || '—'} · ${r.date}</div>
      </div>
      <div class="tx-amount">${r._type === 'income' ? '+' : '−'}$${fmt(r.amount)}</div>
      <button class="tx-del" onclick="deleteTx('${r._type}',${r.id})">✕</button>
    </div>`).join('');

  document.getElementById('empty').style.display = combined.length ? 'none' : 'block';
  setEl('txCount', `${combined.length} item${combined.length !== 1 ? 's' : ''}`);

  renderAccountStrip();
}

// ─── CHARTS ───────────────────────────────────────────────────
function updateCharts() {
  const incData = filterByMonth(_incomeRecords);
  const expData = filterByMonth(_expenseRecords);
  const iT = {}, eT = {};

  incData.forEach(r => { iT[r.category] = (iT[r.category] || 0) + parseFloat(r.amount || 0); });
  expData.forEach(r => { eT[r.category] = (eT[r.category] || 0) + parseFloat(r.amount || 0); });

  const CC = ['#c9a84c','#5cba8a','#6a9fd8','#e05c5c','#b07cde','#e8a44a','#5cbab0','#de7ca4','#8aae5c','#c95c8a'];
  const hasI = Object.keys(iT).length > 0;
  const hasE = Object.keys(eT).length > 0;

  document.getElementById('incomeChart').style.display      = hasI ? 'block' : 'none';
  document.getElementById('incomeChartEmpty').style.display = hasI ? 'none'  : 'block';
  document.getElementById('expenseChart').style.display     = hasE ? 'block' : 'none';
  document.getElementById('expenseChartEmpty').style.display = hasE ? 'none' : 'block';

  if (incomeChart)  incomeChart.destroy();
  if (expenseChart) expenseChart.destroy();

  const opts = (labels, values) => ({
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: CC, borderColor: '#0e0e10', borderWidth: 3, hoverOffset: 6 }] },
    options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#7a7870', font: { family: 'DM Sans', size: 12 }, padding: 14, boxWidth: 10, boxHeight: 10 } } } }
  });

  if (hasI) incomeChart  = new Chart(document.getElementById('incomeChart'),  opts(Object.keys(iT), Object.values(iT)));
  if (hasE) expenseChart = new Chart(document.getElementById('expenseChart'), opts(Object.keys(eT), Object.values(eT)));

  const rb = (cId, eId, totals) => {
    const el = document.getElementById(cId), em = document.getElementById(eId);
    el.innerHTML = '';
    const ks = Object.keys(totals);
    if (!ks.length) { em.style.display = 'block'; return; }
    em.style.display = 'none';
    const max = Math.max(...Object.values(totals));
    ks.forEach((k, i) => {
      const p = Math.round(totals[k] / max * 100);
      el.innerHTML += `<div class="cat-row">
        <div class="cat-dot" style="background:${CC[i % CC.length]}"></div>
        <div class="cat-name">${k}</div>
        <div class="cat-bar-wrap"><div class="cat-bar" style="width:${p}%;background:${CC[i % CC.length]}"></div></div>
        <div class="cat-amount">$${fmt(totals[k])}</div>
      </div>`;
    });
  };
  rb('incomeCatBreakdown',  'incomeCatEmpty',  iT);
  rb('expenseCatBreakdown', 'expenseCatEmpty', eT);
}

// ─── NAVIGATION ──────────────────────────────────────────────
function navTo(id) {
  const btn = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
  showSection(id, btn);
}

// ─── PLANNED BUDGET / SAVINGS RETRIEVAL ──────────────────────
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (btn) btn.classList.add('active');

  const titles = {
    dashboard:'Dashboard', accounts:'Accounts', analytics:'Analytics',
    income:'Income', expenses:'Expenses', transfers:'Transfers',
    budget:'Budget', savings:'Savings Goals', debt:'Debt',
    categories:'Categories', add:'Add Transaction'
  };
  setEl('pageTitle', titles[id] || id);

  if (id === 'analytics')  updateCharts();
  if (id === 'categories') renderCategoryChips();
  if (id === 'accounts')   renderAccountsSection();
  if (id === 'income')     renderIncomeSection();
  if (id === 'expenses')   renderExpenseSection();
  if (id === 'transfers')  renderTransferSection();
  if (id === 'budget')     renderBudgetSection();
  if (id === 'savings')    renderSavingsSection();
  if (id === 'debt')       renderDebtSection();
  if (id === 'add')        { loadCategories2(); }
  closeSidebar();
}

// ─── SIDEBAR / PROFILE ────────────────────────────────────────
function toggleSidebar()  { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function closeSidebar()   { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
function toggleProfileMenu() {
  const m = document.getElementById('profileMenu');
  const c = document.getElementById('profileChevron');
  const open = m.classList.toggle('show');
  c.style.transform = open ? 'rotate(180deg)' : '';
}
function closeProfileMenu() { document.getElementById('profileMenu').classList.remove('show'); document.getElementById('profileChevron').style.transform = ''; }
document.addEventListener('click', e => { const pw = document.getElementById('profileWrap'); if (pw && !pw.contains(e.target)) closeProfileMenu(); });

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, kind = 'success') {
  const t = document.getElementById('toast');
  t.innerHTML = (kind === 'success' ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-xmark"></i> ') + msg;
  t.className = 'toast ' + kind + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── MODAL ────────────────────────────────────────────────────
function openModal(title, html) {
  setEl('modalTitle', title);
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('modal').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('modal').classList.remove('show');
}

// ─── LOGOUT ───────────────────────────────────────────────────
function confirmLogout() {
  closeProfileMenu();
  document.getElementById('logoutOverlay').classList.add('show');
  document.getElementById('logoutDialog').classList.add('show');
}
function closeLogoutDialog() {
  document.getElementById('logoutOverlay').classList.remove('show');
  document.getElementById('logoutDialog').classList.remove('show');
}
async function doLogout() {
  await api('/logout', { method: 'POST' });
  window.location.href = 'login.html';
}

// ─── DEBT DIALOG (balance guard) ─────────────────────────────
function showDebtDialog(pending) {
  _pendingExpense = pending;
  setEl('debtDialogMsg', `The account you selected doesn't have enough balance for $${fmt(pending.amount)}.`);
  setEl('debtShortfall', `Go to the Debt tab, record a loan — it will be credited to your account as income.`);
  document.getElementById('debtDialogOverlay').classList.add('show');
  document.getElementById('debtDialog').classList.add('show');
}
function closeDebtDialog() {
  document.getElementById('debtDialogOverlay').classList.remove('show');
  document.getElementById('debtDialog').classList.remove('show');
}
function goToDebtTab() {
  closeDebtDialog();
  if (_pendingExpense) {
    const rem = document.getElementById('debtReminder');
    setEl('debtReminderSub', `You were trying to add "${ _pendingExpense.description}" ($${fmt(_pendingExpense.amount)}). Add a loan below to credit that account, then retry.`);
    if (rem) rem.style.display = 'flex';
  }
  navTo('debt');
  showToast('Add your loan below — it will be credited to your balance');
}

// ─── FILTER TABLE ─────────────────────────────────────────────
function filterTbody(id, q) {
  document.querySelectorAll(`#${id} tr`).forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ─── PLANNING (localStorage & API integrations) ───────────────
function openPlanModal(kind, existing) {
  const isEdit = !!existing;
  let title = '', html = '';

  if (kind === 'budget') {
    title = isEdit ? 'Edit Budget' : 'New Budget';
    const cats = _expenseCategories;
    html = `<form onsubmit="submitPlan(event,'budget',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Category</label>
        <select name="category" class="form-input" required>
          ${cats.map(c=>`<option value="${c.name}" ${existing?.category===c.name?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label class="form-label">Limit ($)</label><input name="limit" type="number" class="form-input" value="${existing?.limit||''}" placeholder="0.00" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Period</label>
          <select name="period" class="form-input">
            <option value="monthly" ${existing?.period==='monthly'?'selected':''}>Monthly</option>
            <option value="weekly"  ${existing?.period==='weekly'?'selected':''}>Weekly</option>
            <option value="yearly"  ${existing?.period==='yearly'?'selected':''}>Yearly</option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn-submit">${isEdit?'Save':'Create Budget'}</button>
    </form>`;
  }

  if (kind === 'savings') {
    title = isEdit ? 'Edit Goal' : 'New Savings Goal';
    html = `<form onsubmit="submitPlan(event,'savings',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px"><label class="form-label">Goal name</label><input name="name" class="form-input" value="${existing?.name||''}" placeholder="e.g. Emergency fund" required></div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label class="form-label">Target ($)</label><input name="target" type="number" class="form-input" value="${existing?.target||''}" placeholder="0.00" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Saved so far ($)</label><input name="saved" type="number" class="form-input" value="${existing?.saved||0}" placeholder="0.00" step="0.01" min="0"></div>
      </div>
      <div class="form-group" style="margin-bottom:20px"><label class="form-label">Target date (optional)</label><input name="target_date" type="date" class="form-input" value="${existing?.target_date||''}"></div>
      <button type="submit" class="btn-submit">${isEdit?'Save':'Create Goal'}</button>
    </form>`;
  }

  if (kind === 'debt') {
    title = isEdit ? 'Edit Debt' : 'Add Debt / Loan';
    const accOpts = _accounts.map(a => 
      `<option value="${a.id}" ${existing?.account_id == a.id ? 'selected' : ''}>${a.name} ($${fmt(a.balance)})</option>`
    ).join('');

    html = `<form onsubmit="submitPlan(event,'debt',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px"><label class="form-label">Name / Lender</label><input name="name" class="form-input" value="${existing?.name||''}" placeholder="e.g. Bank loan" required></div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Credit loan to account</label>
        <select name="account_id" class="form-input">${accOpts}</select>
      </div>
      <div class="form-grid" style="margin-bottom:20px">
        <div class="form-group"><label class="form-label">Borrowed amount ($)</label><input name="total" type="number" class="form-input" value="${existing?.total||''}" placeholder="0.00" step="0.01" min="0" required></div>
        <div class="form-group"><label class="form-label">Amount paid back ($)</label><input name="paid" type="number" class="form-input" value="${existing?.paid||0}" placeholder="0.00" step="0.01" min="0"></div>
        <div class="form-group"><label class="form-label">Interest rate (%)</label><input name="interest_rate" type="number" class="form-input" value="${existing?.interest_rate||''}" placeholder="e.g. 12.5" step="0.01" min="0"></div>
        <div class="form-group"><label class="form-label">Due date (optional)</label><input name="due_date" type="date" class="form-input" value="${existing?.due_date||''}"></div>
      </div>
      <button type="submit" class="btn-submit">${isEdit?'Save':'Add Debt & Credit Balance'}</button>
    </form>`;
  }

  openModal(title, html);
}

async function submitPlan(e, kind, editId) {
  e.preventDefault();
  const raw  = Object.fromEntries(new FormData(e.target));
  const numFields = { budget:['limit'], savings:['target','saved'], debt:['total','paid','interest_rate'] };
  const data = { ...raw };
  if (!editId && kind !== 'debt') data.id = Date.now();
  (numFields[kind] || []).forEach(k => { if (raw[k] !== '') data[k] = parseFloat(raw[k]) || 0; });

  if (kind === 'debt') {
    const totalAmount = parseFloat(raw.total) || 0;
    const paidAmount = parseFloat(raw.paid) || 0;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);

    const dbPayload = {
      creditor_name: raw.name.trim(),
      total_amount: totalAmount,
      remaining_amount: remainingAmount,
      due_date: raw.due_date || null,
      description: raw.description ? raw.description.trim() : '',
      account_id: parseInt(raw.account_id) || null
    };
    
    const endpoint = editId ? `/debts/${editId}` : '/debts';
    const method = editId ? 'PUT' : 'POST';
    
    const { ok, data: resData } = await api(endpoint, {
      method,
      body: JSON.stringify(dbPayload),
    });

    if (ok) {
      showToast(editId ? 'Updated!' : 'Created!');
      closeModal();
      await loadAccounts();
      await loadDebts();
      renderDebtSection();
      renderDashWidgets();

      // Check if pending expense can now be covered
      if (_pendingExpense) {
        const targetAcc = _accounts.find(a => a.id === _pendingExpense.account_id);
        if (targetAcc && parseFloat(targetAcc.balance) >= parseFloat(_pendingExpense.amount)) {
          const endpointTx = _pendingExpense._type === 'income' ? '/income' : '/expenses';
          const { ok: txOk } = await api(endpointTx, {
            method: 'POST',
            body: JSON.stringify({
              description: _pendingExpense.description,
              amount: _pendingExpense.amount,
              date: _pendingExpense.date,
              account_id: _pendingExpense.account_id,
              category_id: _pendingExpense.category_id
            }),
          });
          if (txOk) {
            showToast(`Pending transaction "${_pendingExpense.description}" processed successfully!`);
            _pendingExpense = null;
            const rem = document.getElementById('debtReminder');
            if (rem) rem.style.display = 'none';
            await loadAccounts();
            await loadExpenseRecords();
            await loadIncomeRecords();
            render();
          }
        }
      }
    } else {
      showToast(resData.message || 'Could not save debt properties', 'error');
    }
    return;
  }

  const stores = { budget: budgets, savings: savingsGoals };
  const arr    = stores[kind];
  if (editId) { const i = arr.findIndex(x => x.id === editId); if (i >= 0) arr[i] = { ...arr[i], ...data, id: editId }; }
  else        { arr.push(data); }

  saveLocal();
  if (kind === 'budget')  { renderBudgetSection();  renderDashWidgets(); }
  if (kind === 'savings') { renderSavingsSection(); renderDashWidgets(); }
  closeModal();
  showToast(editId ? 'Updated!' : 'Created!');
}

async function deletePlan(kind, id) {
  if (kind === 'debt') {
    const { ok, data } = await api(`/debts/${id}`, { method: 'DELETE' });
    if (ok) {
      showToast('Deleted');
      await loadDebts();
      renderDebtSection();
      renderDashWidgets();
    } else {
      showToast(data.message || 'Could not delete debt item', 'error');
    }
    return;
  }

  if (kind === 'budget')  budgets      = budgets.filter(x => x.id !== id);
  if (kind === 'savings') savingsGoals = savingsGoals.filter(x => x.id !== id);
  saveLocal();
  if (kind === 'budget')  { renderBudgetSection();  renderDashWidgets(); }
  if (kind === 'savings') { renderSavingsSection(); renderDashWidgets(); }
  showToast('Deleted');
}

function planCard(item, kind, badge, nums, pct, barCls, sub) {
  const title = item.creditor_name || item.name || item.category || '—';
  return `<div class="planning-card">
    <div class="planning-card-top">
      <span class="planning-card-title">${title}</span>${badge}
      <div class="planning-card-actions">
        <button class="action-btn" onclick="openPlanModal('${kind}',${JSON.stringify(item).replace(/"/g,'&quot;')})">✎</button>
        <button class="action-btn del" onclick="deletePlan('${kind}',${item.id})">✕</button>
      </div>
    </div>
    <div class="planning-numbers">${nums}</div>
    <div class="prog-track"><div class="prog-bar ${barCls}" style="width:${pct}%"></div></div>
    <div class="planning-sub">${sub}</div>
  </div>`;
}

function renderBudgetSection() {
  const el      = document.getElementById('budget-cards');
  const expData = filterByMonth(_expenseRecords);
  let totalB = 0, totalS = 0;
  el.innerHTML = budgets.map(b => {
    const spent = expData.filter(r => r.category === b.category).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const pct   = b.limit > 0 ? Math.min(Math.round(spent / b.limit * 100), 100) : 0;
    const rem   = b.limit - spent;
    const sc    = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
    totalB += b.limit; totalS += spent;
    return planCard(b, 'budget',
      `<span class="planning-badge ${sc}">${pct>=100?'At limit':pct>=80?'Near limit':'On track'}</span>`,
      `<span style="color:var(--red)">$${fmt(spent)} spent</span><span style="color:var(--text-muted)">of $${fmt(b.limit)}</span>`,
      pct, sc, `${rem>=0?'$'+fmt(rem)+' remaining':'$'+fmt(Math.abs(rem))+' over'} · ${b.period||'monthly'}`
    );
  }).join('');
  setEl('budgetTotal',     '$' + fmt(totalB));
  setEl('budgetRemaining', '$' + fmt(Math.max(totalB - totalS, 0)));
  document.getElementById('budget-empty').style.display = budgets.length ? 'none' : 'block';
}

function renderSavingsSection() {
  const el    = document.getElementById('savings-cards');
  const total = savingsGoals.reduce((s, g) => s + (parseFloat(g.saved) || 0), 0);
  setEl('savingsTotal', '$' + fmt(total));
  setEl('savingsCount', savingsGoals.length);
  setEl('dashSaved',    fmt(total));
  el.innerHTML = savingsGoals.map(g => {
    const saved  = parseFloat(g.saved) || 0;
    const target = parseFloat(g.target) || 0;
    const pct    = target > 0 ? Math.min(Math.round(saved / target * 100), 100) : 0;
    return planCard(g, 'savings',
      `<span class="planning-badge ${pct>=100?'ok':'info'}">${pct>=100?'Complete':pct+'%'}</span>`,
      `<span style="color:var(--gold)">$${fmt(saved)} saved</span><span style="color:var(--text-muted)">of $${fmt(target)}</span>`,
      pct, 'gold-bar', g.target_date ? `Target: ${g.target_date}` : 'No target date'
    );
  }).join('');
  document.getElementById('savings-empty').style.display = savingsGoals.length ? 'none' : 'block';
}

function renderDebtSection() {
  const el        = document.getElementById('debt-cards');
  const totalOwed = _debts.reduce((s, d) => s + (parseFloat(d.total_amount) || 0) - (parseFloat(d.remaining_amount) || 0), 0);
  const totalPaid = _debts.reduce((s, d) => s + (parseFloat(d.total_amount) || 0) - (parseFloat(d.remaining_amount) || 0), 0);
  setEl('debtTotal', '$' + fmt(Math.max(totalOwed, 0)));
  setEl('debtPaid',  '$' + fmt(totalPaid));
  el.innerHTML = _debts.map(d => {
    const total = parseFloat(d.total_amount) || 0;
    const rem   = parseFloat(d.remaining_amount) || 0;
    const paid  = Math.max(total - rem, 0);
    const pct   = total > 0 ? Math.min(Math.round(paid / total * 100), 100) : 0;
    const done  = pct >= 100;
    const sc    = done ? 'ok' : pct >= 50 ? 'warn' : 'danger';
    const accName = _accounts.find(a => a.id == d.account_id)?.name || '—';
    return planCard(d, 'debt',
      `<span class="planning-badge ${sc}">${done ? 'Paid off' : pct + '% paid'}</span>`,
      `<span style="color:var(--green)">$${fmt(paid)} paid</span><span style="color:var(--text-muted)">of $${fmt(total)}</span>`,
      pct, done ? 'ok' : 'danger',
      `${done ? 'Fully paid!' : '$' + fmt(rem) + ' left'}${d.interest_rate ? ' · ' + d.interest_rate + '%' : ''}${d.due_date ? ' · Due ' + d.due_date : ''} · Credited to ${accName}`
    );
  }).join('');
  document.getElementById('debt-empty').style.display = _debts.length ? 'none' : 'block';
}

function renderDashWidgets() {
  const expData = filterByMonth(_expenseRecords);

  const bl = document.getElementById('dashBudgetList');
  bl.innerHTML = budgets.length ? budgets.slice(0, 4).map(b => {
    const spent = expData.filter(r => r.category === b.category).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const pct   = b.limit > 0 ? Math.min(Math.round(spent / b.limit * 100), 100) : 0;
    return `<div class="widget-row"><span class="widget-label">${b.category}</span><div class="prog-track sm"><div class="prog-bar ${pct>=100?'danger':pct>=80?'warn':'ok'}" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No budgets. <button class="inline-link" onclick="navTo('budget')">Add →</button></div>`;

  const sl = document.getElementById('dashSavingsList');
  sl.innerHTML = savingsGoals.length ? savingsGoals.slice(0, 3).map(g => {
    const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
    return `<div class="widget-row"><span class="widget-label">${g.name}</span><div class="prog-track sm"><div class="prog-bar gold-bar" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No goals. <button class="inline-link" onclick="navTo('savings')">Create →</button></div>`;

  const dl = document.getElementById('dashDebtList');
  dl.innerHTML = _debts.length ? _debts.slice(0, 3).map(d => {
    const rem = (parseFloat(d.total) || 0) - (parseFloat(d.paid) || 0);
    const pct = d.total > 0 ? Math.min(Math.round(((d.total - rem) / d.total) * 100), 100) : 0;
    return `<div class="widget-row"><span class="widget-label">${d.name}</span><div class="prog-track sm"><div class="prog-bar danger" style="width:${Math.max(100-pct,0)}%"></div></div><span class="widget-val">$${fmt(rem)} left</span></div>`;
  }).join('') : `<div class="widget-empty">No debts. <button class="inline-link" onclick="navTo('debt')">Add →</button></div>`;
}

// ─── BOOT ─────────────────────────────────────────────────────
initApp();
