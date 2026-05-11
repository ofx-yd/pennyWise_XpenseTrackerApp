// ─── DATA ───
let defaultIncome  = ['Salary','Business','Investment','Freelance','Bonus'];
let defaultExpense = ['Food','Transport','Entertainment','Bills','Shopping','Health'];
let customIncome   = JSON.parse(localStorage.getItem('customIncome'))  || [];
let customExpense  = JSON.parse(localStorage.getItem('customExpense')) || [];
let transactions   = JSON.parse(localStorage.getItem('transactions'))  || [];
let budgets        = JSON.parse(localStorage.getItem('budgets'))       || [];
let savingsGoals   = JSON.parse(localStorage.getItem('savingsGoals'))  || [];
let debts          = JSON.parse(localStorage.getItem('debts'))         || [];
let transfers      = JSON.parse(localStorage.getItem('transfers'))     || [];

let type = 'income', type2 = 'income';
let incomeChart, expenseChart;

// Pending expense data when user triggers insufficient balance dialog
let _pendingExpense = null;

// Fix legacy data
transactions = transactions.map(t => ({
  ...t,
  category: t.category || 'Other',
  date: t.date || new Date().toISOString().slice(0,10)
}));

// ─── USER ───
const _email = localStorage.getItem('userEmail') || '';
const _name  = _email ? _email.split('@')[0] : 'User';
const _displayName = _name.charAt(0).toUpperCase() + _name.slice(1);
const _initials = _name.slice(0,2).toUpperCase();

['userAvatar','topbarAvatar','menuAvatar'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.textContent = _initials;
});
setEl('userName',        _displayName);
setEl('topbarName',      _displayName);
setEl('menuName',        _displayName);
setEl('userEmailDisplay', _email || 'Guest');
setEl('menuEmail',       _email || 'Guest');

function setEl(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

// ─── PROFILE DROPDOWN ───
function toggleProfileMenu() {
  const menu    = document.getElementById('profileMenu');
  const chevron = document.getElementById('profileChevron');
  const open    = menu.classList.toggle('show');
  chevron.style.transform = open ? 'rotate(180deg)' : '';
}
function closeProfileMenu() {
  document.getElementById('profileMenu').classList.remove('show');
  document.getElementById('profileChevron').style.transform = '';
}
document.addEventListener('click', e => {
  if (!document.getElementById('profileWrap').contains(e.target)) closeProfileMenu();
});

// ─── COLORS ───
const CHART_COLORS = [
  '#c9a84c','#5cba8a','#6a9fd8','#e05c5c','#b07cde',
  '#e8a44a','#5cbab0','#de7ca4','#8aae5c','#c95c8a'
];

const CATEGORY_ICONS = {
  'Salary':'💼','Business':'🏢','Investment':'📈','Freelance':'💻','Bonus':'🎁',
  'Food':'🍔','Transport':'🚗','Entertainment':'🎬','Bills':'🧾','Shopping':'🛍️',
  'Health':'🏥','Debt':'💳','Other':'📌'
};
function catIcon(cat) { return CATEGORY_ICONS[cat] || '📌'; }

// ─── NAV ───
function navTo(id) {
  const btn = document.querySelector(`.nav-item[onclick*="${id}"]`);
  showSection(id, btn);
}

function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = {
    dashboard:'Dashboard', transactions:'Transactions', analytics:'Analytics',
    categories:'Categories', add:'Add Transaction', income:'Income',
    expenses:'Expenses', transfers:'Transfers', budget:'Budget',
    savings:'Savings Goals', debt:'Debt'
  };
  setEl('pageTitle', titles[id] || id);
  if (id === 'analytics')    updateCharts();
  if (id === 'categories')   renderCategoryChips();
  if (id === 'transactions') renderTxList2();
  if (id === 'add')          loadCategories2();
  if (id === 'income')       renderIncomeSection();
  if (id === 'expenses')     renderExpenseSection();
  if (id === 'transfers')    renderTransferSection();
  if (id === 'budget')       renderBudgetSection();
  if (id === 'savings')      renderSavingsSection();
  if (id === 'debt')         renderDebtSection();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}
function logout() {
  localStorage.removeItem('userEmail');
  window.location.href = 'login.html';
}

// ─── TOAST ───
function showToast(msg, kind = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (kind === 'success' ? '✓ ' : '✗ ') + msg;
  t.className = 'toast ' + kind + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── MODAL ───
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

// ─── INSUFFICIENT BALANCE DIALOG ───
function showDebtDialog(pendingData) {
  _pendingExpense = pendingData;
  const bal = getNetBalance();
  setEl('debtDialogMsg',
    `Your net balance is $${bal.toFixed(2)} but you're trying to spend $${pendingData.amount.toFixed(2)}. ` +
    `Would you like to record this as a debt instead?`
  );
  document.getElementById('debtDialogOverlay').classList.add('show');
  document.getElementById('debtDialog').classList.add('show');
}
function closeDebtDialog() {
  _pendingExpense = null;
  document.getElementById('debtDialogOverlay').classList.remove('show');
  document.getElementById('debtDialog').classList.remove('show');
}
function proceedAsDebt() {
  if (!_pendingExpense) return;
  const d = _pendingExpense;
  debts.push({
    id: Date.now(),
    name: d.text + ' (expense debt)',
    total: d.amount,
    paid: 0,
    due_date: d.date,
    interest_rate: ''
  });
  saveLocal();
  renderDebtSection();
  renderDashWidgets();
  closeDebtDialog();
  showToast('Recorded as a debt');
  // Also add the expense as a transaction so books balance
  transactions.push({ id: Date.now() + 1, text: d.text, amount: -d.amount, category: d.category, date: d.date });
  save(); render(); renderTxList2(); renderExpenseSection();
}

function getNetBalance() {
  return transactions.reduce((s, t) => s + t.amount, 0);
}

// ─── TRANSACTION MODAL (income / expense) ───
function openTxModal(txType, existing) {
  const cats = allCats(txType);
  const catOptions = cats.map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('');
  const isEdit = !!existing;
  const html = `
    <form onsubmit="submitTx(event,'${txType}',${existing ? existing.id : 'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Description</label>
        <input name="text" class="form-input" value="${existing?.text||''}" placeholder="e.g. Grocery run" required>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group">
          <label class="form-label">Amount ($)</label>
          <input name="amount" type="number" class="form-input" value="${existing ? Math.abs(existing.amount) : ''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input name="date" type="date" class="form-input" value="${existing?.date||today()}" required>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Category</label>
        <select name="category" class="form-input" required>
          <option value="">Select…</option>${catOptions}
        </select>
      </div>
      <button type="submit" class="btn-submit">${isEdit ? 'Save Changes' : (txType==='income' ? 'Add Income' : 'Add Expense')}</button>
    </form>`;
  openModal((isEdit ? 'Edit ' : 'Add ') + (txType === 'income' ? 'Income' : 'Expense'), html);
}

function submitTx(e, txType, editId) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const text = fd.get('text').trim();
  const amt  = parseFloat(fd.get('amount'));
  const cat  = fd.get('category');
  const date = fd.get('date');
  if (!text || !amt || !cat || !date) { showToast('Fill all fields', 'error'); return; }

  if (txType === 'expense' && !editId) {
    const bal = getNetBalance();
    if (amt > bal) {
      closeModal();
      showDebtDialog({ text, amount: amt, category: cat, date });
      return;
    }
  }

  const amount = txType === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  if (editId) {
    const i = transactions.findIndex(t => t.id === editId);
    if (i >= 0) transactions[i] = { ...transactions[i], text, amount, category: cat, date };
  } else {
    transactions.push({ id: Date.now(), text, amount, category: cat, date });
  }
  save(); render(); renderTxList2();
  if (txType === 'income')   renderIncomeSection();
  if (txType === 'expense')  renderExpenseSection();
  closeModal();
  showToast(editId ? 'Updated!' : 'Added!');
}

// ─── PLANNING MODAL (budget / savings / debt / transfer) ───
function openPlanModal(kind, existing) {
  const isEdit = !!existing;
  let title = '', html = '';

  if (kind === 'budget') {
    const cats = allCats('expense');
    title = isEdit ? 'Edit Budget' : 'New Budget';
    html = `<form onsubmit="submitPlan(event,'budget',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Category</label>
        <select name="category" class="form-input" required>
          ${cats.map(c=>`<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group">
          <label class="form-label">Limit ($)</label>
          <input name="limit" type="number" class="form-input" value="${existing?.limit||''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Period</label>
          <select name="period" class="form-input">
            <option value="monthly" ${existing?.period==='monthly'?'selected':''}>Monthly</option>
            <option value="weekly"  ${existing?.period==='weekly'?'selected':''}>Weekly</option>
            <option value="yearly"  ${existing?.period==='yearly'?'selected':''}>Yearly</option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn-submit">${isEdit?'Save Changes':'Create Budget'}</button>
    </form>`;
  }

  if (kind === 'savings') {
    title = isEdit ? 'Edit Goal' : 'New Savings Goal';
    html = `<form onsubmit="submitPlan(event,'savings',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Goal name</label>
        <input name="name" class="form-input" value="${existing?.name||''}" placeholder="e.g. Emergency fund" required>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group">
          <label class="form-label">Target ($)</label>
          <input name="target" type="number" class="form-input" value="${existing?.target||''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Saved so far ($)</label>
          <input name="saved" type="number" class="form-input" value="${existing?.saved||0}" placeholder="0.00" step="0.01" min="0">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Target date (optional)</label>
        <input name="target_date" type="date" class="form-input" value="${existing?.target_date||''}">
      </div>
      <button type="submit" class="btn-submit">${isEdit?'Save Changes':'Create Goal'}</button>
    </form>`;
  }

  if (kind === 'debt') {
    title = isEdit ? 'Edit Debt' : 'Add Debt';
    html = `<form onsubmit="submitPlan(event,'debt',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Debt name</label>
        <input name="name" class="form-input" value="${existing?.name||''}" placeholder="e.g. Student loan" required>
      </div>
      <div class="form-grid" style="margin-bottom:20px">
        <div class="form-group">
          <label class="form-label">Total amount ($)</label>
          <input name="total" type="number" class="form-input" value="${existing?.total||''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Amount paid ($)</label>
          <input name="paid" type="number" class="form-input" value="${existing?.paid||0}" placeholder="0.00" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Interest rate (%)</label>
          <input name="interest_rate" type="number" class="form-input" value="${existing?.interest_rate||''}" placeholder="e.g. 12.5" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Due date (optional)</label>
          <input name="due_date" type="date" class="form-input" value="${existing?.due_date||''}">
        </div>
      </div>
      <button type="submit" class="btn-submit">${isEdit?'Save Changes':'Add Debt'}</button>
    </form>`;
  }

  if (kind === 'transfer') {
    title = isEdit ? 'Edit Transfer' : 'New Transfer';
    html = `<form onsubmit="submitPlan(event,'transfer',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Description</label>
        <input name="description" class="form-input" value="${existing?.description||''}" placeholder="e.g. Savings transfer" required>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group">
          <label class="form-label">From account</label>
          <input name="from_account" class="form-input" value="${existing?.from_account||''}" placeholder="e.g. Checking" required>
        </div>
        <div class="form-group">
          <label class="form-label">To account</label>
          <input name="to_account" class="form-input" value="${existing?.to_account||''}" placeholder="e.g. Savings" required>
        </div>
        <div class="form-group">
          <label class="form-label">Amount ($)</label>
          <input name="amount" type="number" class="form-input" value="${existing?.amount||''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input name="date" type="date" class="form-input" value="${existing?.date||today()}" required>
        </div>
      </div>
      <button type="submit" class="btn-submit" style="margin-top:6px">${isEdit?'Save Changes':'Add Transfer'}</button>
    </form>`;
  }

  openModal(title, html);
}

function submitPlan(e, kind, editId) {
  e.preventDefault();
  const raw  = Object.fromEntries(new FormData(e.target));
  const data = {};
  Object.keys(raw).forEach(k => {
    const v = raw[k];
    data[k] = (v !== '' && !isNaN(v) && k !== 'category' && k !== 'period' && k !== 'name' && k !== 'description' && k !== 'from_account' && k !== 'to_account' && k !== 'due_date' && k !== 'target_date') ? parseFloat(v) : v;
  });
  data.id = editId || Date.now();

  const stores = { budget: budgets, savings: savingsGoals, debt: debts, transfer: transfers };
  const arr = stores[kind];

  if (editId) {
    const i = arr.findIndex(x => x.id === editId);
    if (i >= 0) arr[i] = { ...arr[i], ...data };
  } else {
    arr.push(data);
  }

  saveLocal();
  if (kind === 'budget')   { renderBudgetSection();   renderDashWidgets(); }
  if (kind === 'savings')  { renderSavingsSection();  renderDashWidgets(); }
  if (kind === 'debt')     { renderDebtSection();     renderDashWidgets(); }
  if (kind === 'transfer') { renderTransferSection(); }
  closeModal();
  showToast(editId ? 'Updated!' : 'Created!');
}

// ─── DELETE ───
function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  save(); render(); renderTxList2(); renderIncomeSection(); renderExpenseSection();
  showToast('Deleted');
}
function deletePlan(kind, id) {
  const stores = { budget: budgets, savings: savingsGoals, debt: debts, transfer: transfers };
  stores[kind] = stores[kind].filter(x => x.id !== id);
  if (kind === 'budget')   budgets      = stores[kind];
  if (kind === 'savings')  savingsGoals = stores[kind];
  if (kind === 'debt')     debts        = stores[kind];
  if (kind === 'transfer') transfers    = stores[kind];
  saveLocal();
  if (kind === 'budget')   { renderBudgetSection();   renderDashWidgets(); }
  if (kind === 'savings')  { renderSavingsSection();  renderDashWidgets(); }
  if (kind === 'debt')     { renderDebtSection();     renderDashWidgets(); }
  if (kind === 'transfer') renderTransferSection();
  showToast('Deleted');
}

// ─── SECTION RENDERERS ───
function renderIncomeSection() {
  const data = getFiltered().filter(t => t.amount > 0);
  const tbody = document.getElementById('income-tbody');
  const empty = document.getElementById('income-empty');
  setEl('incomeTotal',  '$' + data.reduce((s,t)=>s+t.amount,0).toFixed(2));
  setEl('incomeCount',  data.length);
  tbody.innerHTML = data.map(t => `<tr>
    <td>${t.text}</td>
    <td><span class="badge-cat income-tag">${t.category}</span></td>
    <td style="color:var(--green);font-weight:600">+$${t.amount.toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date}</td>
    <td class="td-actions">
      <button class="action-btn" onclick="openTxModal('income',${JSON.stringify(t).replace(/"/g,'&quot;')})">✎</button>
      <button class="action-btn del" onclick="deleteTx(${t.id})">✕</button>
    </td></tr>`).join('');
  empty.style.display = data.length ? 'none' : 'block';
}

function renderExpenseSection() {
  const data = getFiltered().filter(t => t.amount < 0);
  const tbody = document.getElementById('expense-tbody');
  const empty = document.getElementById('expense-empty');
  setEl('expenseTotal', '$' + data.reduce((s,t)=>s+Math.abs(t.amount),0).toFixed(2));
  setEl('expenseCount', data.length);
  tbody.innerHTML = data.map(t => `<tr>
    <td>${t.text}</td>
    <td><span class="badge-cat expense-tag">${t.category}</span></td>
    <td style="color:var(--red);font-weight:600">−$${Math.abs(t.amount).toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date}</td>
    <td class="td-actions">
      <button class="action-btn" onclick="openTxModal('expense',${JSON.stringify({...t,amount:Math.abs(t.amount)}).replace(/"/g,'&quot;')})">✎</button>
      <button class="action-btn del" onclick="deleteTx(${t.id})">✕</button>
    </td></tr>`).join('');
  empty.style.display = data.length ? 'none' : 'block';
}

function renderTransferSection() {
  const tbody = document.getElementById('transfer-tbody');
  const empty = document.getElementById('transfer-empty');
  setEl('transferTotal', '$' + transfers.reduce((s,t)=>s+(parseFloat(t.amount)||0),0).toFixed(2));
  setEl('transferCount', transfers.length);
  tbody.innerHTML = transfers.map(t => `<tr>
    <td>${t.description||'—'}</td>
    <td style="color:var(--text-muted)">${t.from_account||'—'}</td>
    <td style="color:var(--text-muted)">${t.to_account||'—'}</td>
    <td style="color:var(--blue);font-weight:600">$${parseFloat(t.amount).toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date||'—'}</td>
    <td class="td-actions">
      <button class="action-btn" onclick="openPlanModal('transfer',${JSON.stringify(t).replace(/"/g,'&quot;')})">✎</button>
      <button class="action-btn del" onclick="deletePlan('transfer',${t.id})">✕</button>
    </td></tr>`).join('');
  empty.style.display = transfers.length ? 'none' : 'block';
}

function renderBudgetSection() {
  const el    = document.getElementById('budget-cards');
  const empty = document.getElementById('budget-empty');
  const expData = getFiltered().filter(t => t.amount < 0);
  let totalB = 0, totalS = 0;
  el.innerHTML = budgets.map(b => {
    const spent = expData.filter(t=>t.category===b.category).reduce((s,t)=>s+Math.abs(t.amount),0);
    const pct   = b.limit > 0 ? Math.min(Math.round(spent/b.limit*100),100) : 0;
    const rem   = b.limit - spent;
    const sc    = pct>=100?'danger':pct>=80?'warn':'ok';
    const sl    = pct>=100?'At limit':pct>=80?'Near limit':'On track';
    totalB += b.limit; totalS += spent;
    return planCard(b, 'budget',
      `<span class="planning-badge ${sc}">${sl}</span>`,
      `<span style="color:var(--red)">$${spent.toFixed(2)} spent</span><span style="color:var(--text-muted)">of $${b.limit.toFixed(2)}</span>`,
      pct, sc,
      `${rem>=0?`$${rem.toFixed(2)} remaining`:`$${Math.abs(rem).toFixed(2)} over`} · ${b.period||'monthly'}`
    );
  }).join('');
  setEl('budgetTotal',     '$' + totalB.toFixed(2));
  setEl('budgetRemaining', '$' + Math.max(totalB-totalS,0).toFixed(2));
  empty.style.display = budgets.length ? 'none' : 'block';
}

function renderSavingsSection() {
  const el    = document.getElementById('savings-cards');
  const empty = document.getElementById('savings-empty');
  const total = savingsGoals.reduce((s,g)=>s+(parseFloat(g.saved)||0),0);
  setEl('savingsTotal', '$' + total.toFixed(2));
  setEl('savingsCount', savingsGoals.length);
  setEl('dashSaved',    total.toFixed(2));
  el.innerHTML = savingsGoals.map(g => {
    const saved  = parseFloat(g.saved)||0;
    const target = parseFloat(g.target)||0;
    const pct    = target > 0 ? Math.min(Math.round(saved/target*100),100) : 0;
    const done   = pct >= 100;
    return planCard(g, 'savings',
      `<span class="planning-badge ${done?'ok':'info'}">${done?'Complete':pct+'%'}</span>`,
      `<span style="color:var(--gold)">$${saved.toFixed(2)} saved</span><span style="color:var(--text-muted)">of $${target.toFixed(2)}</span>`,
      pct, 'gold-bar',
      g.target_date ? `Target: ${g.target_date}` : 'No target date'
    );
  }).join('');
  empty.style.display = savingsGoals.length ? 'none' : 'block';
}

function renderDebtSection() {
  const el    = document.getElementById('debt-cards');
  const empty = document.getElementById('debt-empty');
  const totalOwed = debts.reduce((s,d)=>s+(parseFloat(d.total)||0)-(parseFloat(d.paid)||0),0);
  const totalPaid = debts.reduce((s,d)=>s+(parseFloat(d.paid)||0),0);
  setEl('debtTotal', '$' + Math.max(totalOwed,0).toFixed(2));
  setEl('debtPaid',  '$' + totalPaid.toFixed(2));
  el.innerHTML = debts.map(d => {
    const paid  = parseFloat(d.paid)||0;
    const total = parseFloat(d.total)||0;
    const pct   = total > 0 ? Math.min(Math.round(paid/total*100),100) : 0;
    const done  = pct >= 100;
    const rem   = total - paid;
    const sc    = done?'ok':pct>=50?'warn':'danger';
    return planCard(d, 'debt',
      `<span class="planning-badge ${sc}">${done?'Paid off':pct+'% paid'}</span>`,
      `<span style="color:var(--green)">$${paid.toFixed(2)} paid</span><span style="color:var(--text-muted)">of $${total.toFixed(2)}</span>`,
      pct, done?'ok':'danger',
      `${done?'Fully paid!':'$'+rem.toFixed(2)+' left'}${d.interest_rate?' · '+d.interest_rate+'%':''}${d.due_date?' · Due '+d.due_date:''}`
    );
  }).join('');
  empty.style.display = debts.length ? 'none' : 'block';
}

function planCard(item, kind, badgeHtml, numsHtml, pct, barClass, sub) {
  const titleKey = item.name || item.category || item.description || '—';
  return `<div class="planning-card">
    <div class="planning-card-top">
      <span class="planning-card-title">${titleKey}</span>
      ${badgeHtml}
      <div class="planning-card-actions">
        <button class="action-btn" onclick="openPlanModal('${kind}',${JSON.stringify(item).replace(/"/g,'&quot;')})">✎</button>
        <button class="action-btn del" onclick="deletePlan('${kind}',${item.id})">✕</button>
      </div>
    </div>
    <div class="planning-numbers">${numsHtml}</div>
    <div class="prog-track"><div class="prog-bar ${barClass}" style="width:${pct}%"></div></div>
    <div class="planning-sub">${sub}</div>
  </div>`;
}

function renderDashWidgets() {
  const expData = getFiltered().filter(t => t.amount < 0);

  // Budget
  const bl = document.getElementById('dashBudgetList');
  bl.innerHTML = budgets.length ? budgets.slice(0,4).map(b => {
    const spent = expData.filter(t=>t.category===b.category).reduce((s,t)=>s+Math.abs(t.amount),0);
    const pct   = b.limit > 0 ? Math.min(Math.round(spent/b.limit*100),100) : 0;
    const sc    = pct>=100?'danger':pct>=80?'warn':'ok';
    return `<div class="widget-row"><span class="widget-label">${b.category}</span><div class="prog-track sm"><div class="prog-bar ${sc}" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No budgets. <button class="inline-link" onclick="navTo('budget')">Add →</button></div>`;

  // Savings
  const sl = document.getElementById('dashSavingsList');
  sl.innerHTML = savingsGoals.length ? savingsGoals.slice(0,3).map(g => {
    const pct = g.target>0 ? Math.min(Math.round((g.saved/g.target)*100),100) : 0;
    return `<div class="widget-row"><span class="widget-label">${g.name}</span><div class="prog-track sm"><div class="prog-bar gold-bar" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No goals. <button class="inline-link" onclick="navTo('savings')">Create →</button></div>`;

  // Debt
  const dl = document.getElementById('dashDebtList');
  dl.innerHTML = debts.length ? debts.slice(0,3).map(d => {
    const rem = (parseFloat(d.total)||0)-(parseFloat(d.paid)||0);
    const pct = d.total>0 ? Math.min(Math.round(((d.total-rem)/d.total)*100),100) : 0;
    return `<div class="widget-row"><span class="widget-label">${d.name}</span><div class="prog-track sm"><div class="prog-bar danger" style="width:${Math.max(100-pct,0)}%"></div></div><span class="widget-val">$${rem.toFixed(0)} left</span></div>`;
  }).join('') : `<div class="widget-empty">No debts. <button class="inline-link" onclick="navTo('debt')">Add →</button></div>`;
}

// ─── TABLE SEARCH ───
function filterTbody(tbodyId, q) {
  document.querySelectorAll(`#${tbodyId} tr`).forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ─── TRANSACTION HELPERS ───
function getFiltered() {
  const m = document.getElementById('monthFilter').value;
  return m ? transactions.filter(t => t.date && t.date.startsWith(m)) : transactions;
}

function makeTxItem(t, onDel) {
  const el = document.createElement('div');
  el.className = `tx-item ${t.amount > 0 ? 'plus' : 'minus'}`;
  el.innerHTML = `
    <div class="tx-icon">${catIcon(t.category)}</div>
    <div class="tx-info">
      <div class="tx-name">${t.text}</div>
      <div class="tx-meta">${t.category} · ${t.date}</div>
    </div>
    <div class="tx-amount">${t.amount>0?'+':'−'}$${Math.abs(t.amount).toFixed(2)}</div>
    <button class="tx-del" onclick="(${onDel.toString()})()">✕</button>`;
  return el;
}

function render() {
  const data = getFiltered();
  const listEl = document.getElementById('list');
  listEl.innerHTML = '';
  let bal = 0, inc = 0, exp = 0;
  data.forEach(t => {
    bal += t.amount;
    t.amount > 0 ? (inc += t.amount) : (exp += t.amount);
    listEl.appendChild(makeTxItem(t, () => deleteTx(t.id)));
  });
  document.getElementById('empty').style.display = data.length ? 'none' : 'block';
  setEl('txCount',   `${data.length} item${data.length!==1?'s':''}`);
  setEl('balance',   Math.abs(bal).toFixed(2));
  setEl('income',    inc.toFixed(2));
  setEl('expense',   Math.abs(exp).toFixed(2));
  setEl('balance2',  Math.abs(bal).toFixed(2));
  setEl('income2',   inc.toFixed(2));
  setEl('expense2',  Math.abs(exp).toFixed(2));
  renderDashWidgets();
  const saved = savingsGoals.reduce((s,g)=>s+(parseFloat(g.saved)||0),0);
  setEl('dashSaved', saved.toFixed(2));
}

function renderTxList2() {
  const data = getFiltered();
  const el   = document.getElementById('list2');
  el.innerHTML = '';
  data.forEach(t => el.appendChild(makeTxItem(t, () => deleteTx(t.id))));
  document.getElementById('empty2').style.display = data.length ? 'none' : 'block';
  setEl('txCount2', `${data.length} item${data.length!==1?'s':''}`);
}

// ─── QUICK ADD FORM ───
document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('text').value.trim();
  const amt  = parseFloat(document.getElementById('amount').value);
  const cat  = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  if (!text || !amt || !cat || !date) { showToast('Fill all fields', 'error'); return; }

  if (type === 'expense') {
    const bal = getNetBalance();
    if (amt > bal) {
      showDebtDialog({ text, amount: amt, category: cat, date });
      document.getElementById('form').reset();
      setType('income');
      return;
    }
  }

  const amount = type === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  transactions.push({ id: Date.now(), text, amount, category: cat, date });
  save(); render(); renderTxList2();
  document.getElementById('form').reset();
  setType('income');
  showToast('Transaction added!');
});

document.getElementById('form2').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('text2').value.trim();
  const amt  = parseFloat(document.getElementById('amount2').value);
  const cat  = document.getElementById('category2').value;
  const date = document.getElementById('date2').value;
  if (!text || !amt || !cat || !date) { showToast('Fill all fields', 'error'); return; }

  if (type2 === 'expense') {
    const bal = getNetBalance();
    if (amt > bal) {
      showDebtDialog({ text, amount: amt, category: cat, date });
      document.getElementById('form2').reset();
      setType2('income');
      return;
    }
  }

  const amount = type2 === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  transactions.push({ id: Date.now(), text, amount, category: cat, date });
  save(); render(); renderTxList2();
  document.getElementById('form2').reset();
  setType2('income');
  showToast('Transaction added!');
});

// ─── CATEGORIES ───
function setType(t) {
  type = t;
  document.getElementById('incomeBtn').classList.toggle('active', t==='income');
  document.getElementById('expenseBtn').classList.toggle('active', t==='expense');
  loadCategories();
}
function setType2(t) {
  type2 = t;
  document.getElementById('incomeBtn2').classList.toggle('active', t==='income');
  document.getElementById('expenseBtn2').classList.toggle('active', t==='expense');
  loadCategories2();
}
function allCats(t) {
  return t === 'income' ? [...defaultIncome,...customIncome] : [...defaultExpense,...customExpense];
}
function loadCategories() {
  const sel = document.getElementById('category');
  sel.innerHTML = '<option value="">Select category…</option>';
  allCats(type).forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
}
function loadCategories2() {
  const sel = document.getElementById('category2');
  sel.innerHTML = '<option value="">Select category…</option>';
  allCats(type2).forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
}
function saveCategories() {
  localStorage.setItem('customIncome',  JSON.stringify(customIncome));
  localStorage.setItem('customExpense', JSON.stringify(customExpense));
}
document.getElementById('addCategoryBtn').onclick = () => {
  const val = document.getElementById('newCategory').value.trim();
  if (!val) return;
  const arr = type==='income' ? customIncome : customExpense;
  if (arr.some(c=>c.toLowerCase()===val.toLowerCase())) { showToast('Already exists','error'); return; }
  arr.push(val); saveCategories(); document.getElementById('newCategory').value=''; loadCategories();
  showToast(`"${val}" added`);
};
function addCategoryFromForm2() {
  const val = document.getElementById('newCategory2').value.trim();
  if (!val) return;
  const arr = type2==='income' ? customIncome : customExpense;
  if (arr.some(c=>c.toLowerCase()===val.toLowerCase())) { showToast('Already exists','error'); return; }
  arr.push(val); saveCategories(); document.getElementById('newCategory2').value=''; loadCategories2();
  showToast(`"${val}" added`);
}
function addCategory(t) {
  const id  = t==='income' ? 'newIncomeCategory' : 'newExpenseCategory';
  const val = document.getElementById(id).value.trim();
  if (!val) return;
  const arr = t==='income' ? customIncome : customExpense;
  if (arr.some(c=>c.toLowerCase()===val.toLowerCase())) { showToast('Already exists','error'); return; }
  arr.push(val); saveCategories(); document.getElementById(id).value=''; renderCategoryChips();
  showToast(`"${val}" added`);
}
function deleteCategory(cat, t) {
  if (t==='income') customIncome=customIncome.filter(c=>c!==cat);
  else customExpense=customExpense.filter(c=>c!==cat);
  saveCategories(); loadCategories(); loadCategories2(); renderCategoryChips();
  showToast(`"${cat}" removed`);
}
function renderCategoryChips() {
  const ie = document.getElementById('incomeCategoryChips');
  const ee = document.getElementById('expenseCategoryChips');
  ie.innerHTML = ''; ee.innerHTML = '';
  defaultIncome.forEach(c  => { const ch=document.createElement('div'); ch.className='cat-chip default-chip'; ch.textContent=c; ie.appendChild(ch); });
  customIncome.forEach(c   => { const ch=document.createElement('div'); ch.className='cat-chip'; ch.innerHTML=`${c}<button class="cat-chip-del" onclick="deleteCategory('${c}','income')">✕</button>`; ie.appendChild(ch); });
  defaultExpense.forEach(c => { const ch=document.createElement('div'); ch.className='cat-chip default-chip'; ch.textContent=c; ee.appendChild(ch); });
  customExpense.forEach(c  => { const ch=document.createElement('div'); ch.className='cat-chip'; ch.innerHTML=`${c}<button class="cat-chip-del" onclick="deleteCategory('${c}','expense')">✕</button>`; ee.appendChild(ch); });
}

// ─── CHARTS ───
function updateCharts() {
  const data = getFiltered();
  const iT={}, eT={};
  data.forEach(t => { t.amount>0 ? (iT[t.category]=(iT[t.category]||0)+t.amount) : (eT[t.category]=(eT[t.category]||0)+Math.abs(t.amount)); });
  const hasI = Object.keys(iT).length>0;
  const hasE = Object.keys(eT).length>0;
  document.getElementById('incomeChart').style.display  = hasI?'block':'none';
  document.getElementById('incomeChartEmpty').style.display = hasI?'none':'block';
  document.getElementById('expenseChart').style.display = hasE?'block':'none';
  document.getElementById('expenseChartEmpty').style.display = hasE?'none':'block';
  if (incomeChart)  incomeChart.destroy();
  if (expenseChart) expenseChart.destroy();
  const opts = (labels, values) => ({
    type:'doughnut', data:{labels, datasets:[{data:values, backgroundColor:CHART_COLORS, borderColor:'#0e0e10', borderWidth:3, hoverOffset:6}]},
    options:{cutout:'68%', plugins:{legend:{position:'bottom', labels:{color:'#7a7870',font:{family:'DM Sans',size:12},padding:14,boxWidth:10,boxHeight:10}}}}
  });
  if (hasI) incomeChart  = new Chart(document.getElementById('incomeChart'),  opts(Object.keys(iT), Object.values(iT)));
  if (hasE) expenseChart = new Chart(document.getElementById('expenseChart'), opts(Object.keys(eT), Object.values(eT)));
  renderCatBreakdown('incomeCatBreakdown',  'incomeCatEmpty',  iT);
  renderCatBreakdown('expenseCatBreakdown', 'expenseCatEmpty', eT);
}

function renderCatBreakdown(cId, eId, totals) {
  const el = document.getElementById(cId);
  const em = document.getElementById(eId);
  el.innerHTML = '';
  const keys = Object.keys(totals);
  if (!keys.length) { em.style.display='block'; return; }
  em.style.display='none';
  const max = Math.max(...Object.values(totals));
  keys.forEach((k,i) => {
    const pct = Math.round(totals[k]/max*100);
    el.innerHTML += `<div class="cat-row"><div class="cat-dot" style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></div><div class="cat-name">${k}</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%;background:${CHART_COLORS[i%CHART_COLORS.length]}"></div></div><div class="cat-amount">$${totals[k].toFixed(2)}</div></div>`;
  });
}

// ─── PERSIST ───
function save()      { localStorage.setItem('transactions', JSON.stringify(transactions)); }
function saveLocal() {
  localStorage.setItem('budgets',      JSON.stringify(budgets));
  localStorage.setItem('savingsGoals', JSON.stringify(savingsGoals));
  localStorage.setItem('debts',        JSON.stringify(debts));
  localStorage.setItem('transfers',    JSON.stringify(transfers));
}
function today() { return new Date().toISOString().slice(0,10); }

document.getElementById('monthFilter').addEventListener('change', () => { render(); renderTxList2(); updateCharts(); });
document.getElementById('date').value  = today();
document.getElementById('date2').value = today();

// ─── INIT ───
loadCategories();
loadCategories2();
render();
