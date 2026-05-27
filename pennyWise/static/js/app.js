let defaultIncome  = ['Salary','Business','Investment','Freelance','Bonus'];
let defaultExpense = ['Food','Transport','Entertainment','Bills','Shopping','Health'];
let customIncome   = JSON.parse(localStorage.getItem('customIncome'))  || [];
let customExpense  = JSON.parse(localStorage.getItem('customExpense')) || [];
let transactions   = JSON.parse(localStorage.getItem('transactions'))  || [];
let transfers      = JSON.parse(localStorage.getItem('accTransfers'))  || [];
let budgets        = JSON.parse(localStorage.getItem('budgets'))       || [];
let savingsGoals   = JSON.parse(localStorage.getItem('savingsGoals'))  || [];
let debts          = [];  // Now loaded from API

// fix legacy (no account field)
transactions = transactions.map(t => ({
  ...t,
  category: t.category || 'Other',
  date:     t.date     || today(),
  account:  t.account  || 'card'
}));

let txType  = 'income';
let txType2 = 'income';
let incomeChart, expenseChart;
let _pendingExpense = null; // stores blocked expense until user takes a loan

// ─── USER ───
const _email       = localStorage.getItem('userEmail') || '';
const _uname       = _email ? _email.split('@')[0] : 'User';
const _displayName = _uname.charAt(0).toUpperCase() + _uname.slice(1);
const _initials    = _uname.slice(0, 2).toUpperCase();

['userAvatar','topbarAvatar','menuAvatar'].forEach(id => setEl(id, _initials));
setEl('userName', _displayName);
setEl('topbarName', _displayName);
setEl('menuName', _displayName);
setEl('userEmailDisplay', _email || 'Guest');
setEl('menuEmail', _email || 'Guest');

function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

// ─── PROFILE DROPDOWN ───
function toggleProfileMenu() {
  const m = document.getElementById('profileMenu');
  const c = document.getElementById('profileChevron');
  const open = m.classList.toggle('show');
  c.style.transform = open ? 'rotate(180deg)' : '';
}
function closeProfileMenu() {
  document.getElementById('profileMenu').classList.remove('show');
  document.getElementById('profileChevron').style.transform = '';
}
document.addEventListener('click', e => {
  const pw = document.getElementById('profileWrap');
  if (pw && !pw.contains(e.target)) closeProfileMenu();
});

// ─── LOGOUT (with confirm) ───
function confirmLogout() {
  closeProfileMenu();
  document.getElementById('logoutOverlay').classList.add('show');
  document.getElementById('logoutDialog').classList.add('show');
}
function closeLogoutDialog() {
  document.getElementById('logoutOverlay').classList.remove('show');
  document.getElementById('logoutDialog').classList.remove('show');
}
function doLogout() {
  localStorage.removeItem('userEmail');
  window.location.href = 'login.html';
}

// ─── NAVIGATION ───
function navTo(id) {
  const btn = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
  showSection(id, btn);
}
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { dashboard:'Dashboard', accounts:'Accounts', analytics:'Analytics',
    income:'Income', expenses:'Expenses', transfers:'Transfers',
    budget:'Budget', savings:'Savings Goals', debt:'Debt',
    categories:'Categories', add:'Add Transaction' };
  setEl('pageTitle', titles[id] || id);
  if (id === 'analytics')    updateCharts();
  if (id === 'categories')   renderCategoryChips();
  if (id === 'accounts')     renderAccountsSection();
  if (id === 'income')       renderIncomeSection();
  if (id === 'expenses')     renderExpenseSection();
  if (id === 'transfers')    renderTransferSection();
  if (id === 'budget')       renderBudgetSection();
  if (id === 'savings')      renderSavingsSection();
  if (id === 'debt')         loadDebts();  // Load from API
  if (id === 'add')          loadCategories2();
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

// ─── TOAST ───
function showToast(msg, kind = 'success') {
  const t = document.getElementById('toast');
  t.innerHTML = (kind === 'success' ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-xmark"></i> ') + msg;
  t.className = 'toast ' + kind + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
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

// ─── ACCOUNT BALANCES ───
// Balance per account = sum of all transactions for that account
function getAccountBalance(acc) {
  return transactions
    .filter(t => t.account === acc)
    .reduce((s, t) => s + t.amount, 0);
}
// Total net balance across all accounts (never negative on display)
function getNetBalance() {
  return transactions.reduce((s, t) => s + t.amount, 0);
}
function getAccountBalanceSafe(acc) {
  return Math.max(getAccountBalance(acc), 0);
}

const ACC_LABELS = { card: '<i class="fa-solid fa-credit-card"></i> Card', cash: '<i class="fa-solid fa-money-bill-wave"></i> Cash', savings: '<i class="fa-solid fa-building-columns"></i> Savings' };
const ACC_NAMES  = { card: 'Card', cash: 'Cash', savings: 'Savings' };

// ─── INSUFFICIENT BALANCE DIALOG ───
function showDebtDialog(pending) {
  _pendingExpense = pending;
  const accBal = getAccountBalance(pending.account);
  const netBal = getNetBalance();
  setEl('debtDialogMsg',
    `Your ${ACC_NAMES[pending.account]} balance is $${Math.max(accBal,0).toFixed(2)} ` +
    `but you need $${pending.amount.toFixed(2)}.`
  );
  setEl('debtShortfall', `Shortfall: $${(pending.amount - Math.max(accBal,0)).toFixed(2)}`);
  document.getElementById('debtDialogOverlay').classList.add('show');
  document.getElementById('debtDialog').classList.add('show');
}
function closeDebtDialog() {
  document.getElementById('debtDialogOverlay').classList.remove('show');
  document.getElementById('debtDialog').classList.remove('show');
}
function goToDebtTab() {
  closeDebtDialog();
  // Show reminder banner in Debt section
  if (_pendingExpense) {
    const rem = document.getElementById('debtReminder');
    setEl('debtReminderSub',
      `You were trying to add "${_pendingExpense.text}" ($${_pendingExpense.amount.toFixed(2)}) from ${ACC_NAMES[_pendingExpense.account]}. ` +
      `Add a loan below — the amount is credited as income to that account — then retry your expense.`
    );
    if (rem) rem.style.display = 'flex';
  }
  navTo('debt');
  showToast('Add your loan below — it will be credited to your balance');
}

// ─── TRANSACTION MODAL ───
function openTxModal(type, existing, defaultAcc) {
  const cats = allCats(type);
  const accVal = existing?.account || defaultAcc || 'card';
  const html = `
    <form onsubmit="submitTx(event,'${type}',${existing ? existing.id : 'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Description</label>
        <input name="text" class="form-input" value="${existing?.text||''}" placeholder="e.g. Grocery run" required>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group">
          <label class="form-label">Amount ($)</label>
          <input name="amount" type="number" class="form-input" value="${existing?Math.abs(existing.amount):''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input name="date" type="date" class="form-input" value="${existing?.date||today()}" required>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Account</label>
        <select name="account" class="form-input">
          <option value="card"    ${accVal==='card'?'selected':''}>💳 Card</option>
          <option value="cash"    ${accVal==='cash'?'selected':''}>💵 Cash</option>
          <option value="savings" ${accVal==='savings'?'selected':''}>🏦 Savings</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Category</label>
        <select name="category" class="form-input" required>
          <option value="">Select…</option>
          ${cats.map(c=>`<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn-submit">${existing?'Save Changes':(type==='income'?'Add Income':'Add Expense')}</button>
    </form>`;
  openModal((existing?'Edit ':'Add ')+(type==='income'?'Income':'Expense'), html);
}

function submitTx(e, type, editId) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const text = fd.get('text').trim();
  const amt  = parseFloat(fd.get('amount'));
  const acc  = fd.get('account');
  const cat  = fd.get('category');
  const date = fd.get('date');
  if (!text || !amt || !acc || !cat || !date) { showToast('Fill all fields','error'); return; }

  // BALANCE GUARD — only for new expenses (not edits)
  if (type === 'expense' && !editId) {
    const accBal = getAccountBalance(acc);
    if (amt > accBal) {
      closeModal();
      showDebtDialog({ text, amount: amt, account: acc, category: cat, date });
      return;
    }
  }

  const amount = type === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  if (editId) {
    const i = transactions.findIndex(t => t.id === editId);
    if (i >= 0) transactions[i] = { ...transactions[i], text, amount, account: acc, category: cat, date };
  } else {
    transactions.push({ id: Date.now(), text, amount, account: acc, category: cat, date });
  }
  save(); render(); renderAccountsSection();
  if (type === 'income')  renderIncomeSection();
  if (type === 'expense') renderExpenseSection();
  closeModal();
  showToast(editId ? 'Updated!' : 'Added!');
}

// ─── ACCOUNT TRANSFER ───
function submitAccountTransfer() {
  const from   = document.getElementById('tfFrom').value;
  const to     = document.getElementById('tfTo').value;
  const amount = parseFloat(document.getElementById('tfAmount').value);
  const date   = document.getElementById('tfDate').value;
  const note   = document.getElementById('tfNote').value.trim() || `Transfer ${ACC_NAMES[from]} → ${ACC_NAMES[to]}`;

  if (!amount || amount <= 0) { showToast('Enter a valid amount','error'); return; }
  if (from === to)             { showToast('Choose different accounts','error'); return; }
  if (!date)                   { showToast('Choose a date','error'); return; }

  const fromBal = getAccountBalance(from);
  if (amount > fromBal) {
    showToast(`Insufficient ${ACC_NAMES[from]} balance ($${Math.max(fromBal,0).toFixed(2)})`, 'error');
    return;
  }

  const id = Date.now();
  // Debit from source, credit to destination
  transactions.push({ id: id,     text: `Transfer to ${ACC_NAMES[to]}`,   amount: -amount, account: from, category: 'Transfer', date });
  transactions.push({ id: id + 1, text: `Transfer from ${ACC_NAMES[from]}`, amount:  amount, account: to,   category: 'Transfer', date });

  transfers.push({ id: id + 2, note, from, to, amount, date });
  save(); saveLocal(); render(); renderAccountsSection(); renderTransferSection();

  document.getElementById('tfAmount').value = '';
  document.getElementById('tfNote').value   = '';
  showToast(`Transferred $${amount.toFixed(2)} from ${ACC_NAMES[from]} to ${ACC_NAMES[to]}`);
}

// ─── PLANNING MODAL ───
function openPlanModal(kind, existing) {
  const isEdit = !!existing;
  let title = '', html = '';

  if (kind === 'budget') {
    title = isEdit ? 'Edit Budget' : 'New Budget';
    html = `<form onsubmit="submitPlan(event,'budget',${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Category</label>
        <select name="category" class="form-input" required>
          ${allCats('expense').map(c=>`<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
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
    html = `<form onsubmit="submitDebtAPI(event,${existing?.id||'null'})">
      <div class="form-group" style="margin-bottom:14px"><label class="form-label">Creditor / Lender</label><input name="creditor_name" class="form-input" value="${existing?.creditor_name||''}" placeholder="e.g. Bank, Credit Card" required></div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Total amount borrowed ($)</label><input name="total_amount" type="number" class="form-input" value="${existing?.total_amount||''}" placeholder="0.00" step="0.01" min="0" required>
      </div>
      <div class="form-grid" style="margin-bottom:20px">
        <div class="form-group"><label class="form-label">Remaining amount ($)</label><input name="remaining_amount" type="number" class="form-input" value="${existing?.remaining_amount||existing?.total_amount||''}" placeholder="0.00" step="0.01" min="0"></div>
        <div class="form-group"><label class="form-label">Due date (optional)</label><input name="due_date" type="date" class="form-input" value="${existing?.due_date||''}"></div>
      </div>
      <div class="form-group" style="margin-bottom:20px"><label class="form-label">Description (optional)</label><textarea name="description" class="form-input" placeholder="Notes about this debt">${existing?.description||''}</textarea></div>
      <button type="submit" class="btn-submit">${isEdit?'Update Debt':'Add Debt & Credit Balance'}</button>
    </form>`;
  }

  openModal(title, html);
}

/**
 * Submit debt via API (POST for new, PUT for edit)
 */
async function submitDebtAPI(e, debtId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    creditor_name: fd.get('creditor_name'),
    total_amount: parseFloat(fd.get('total_amount')) || 0,
    remaining_amount: parseFloat(fd.get('remaining_amount')) || parseFloat(fd.get('total_amount')) || 0,
    due_date: fd.get('due_date') || null,
    description: fd.get('description') || null
  };

  try {
    const url = debtId ? `/api/debts/${debtId}` : '/api/debts';
    const method = debtId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      showToast(err.error || 'Error saving debt', 'error');
      return;
    }

    closeModal();
    
    // Reload debts from API
    await loadDebts();
    
    // If creating a new debt and account exists, reload accounts to reflect balance
    if (!debtId) {
      await loadAccounts();
      // Check if pending expense can now be covered
      if (_pendingExpense && payload.remaining_amount > 0) {
        showToast(`Loan created! Your balance has been updated. Try your expense again.`);
      }
    }
    
    showToast(debtId ? 'Debt updated!' : 'Debt created and balance credited!');
  } catch (error) {
    console.error('Debt API error:', error);
    showToast('Failed to save debt', 'error');
  }
}

/**
 * Load debts from API
 */
async function loadDebts() {
  try {
    const response = await fetch('/api/debts');
    if (!response.ok) {
      console.error('Failed to load debts');
      debts = [];
      return;
    }
    const data = await response.json();
    debts = data.data || [];
    renderDebtSection();
    renderDashWidgets();
  } catch (error) {
    console.error('Load debts error:', error);
    debts = [];
  }
}

/**
 * Delete debt via API
 */
async function deleteDebtAPI(debtId) {
  if (!confirm('Are you sure? This will reverse the balance credit.')) return;

  try {
    const response = await fetch(`/api/debts/${debtId}`, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json();
      showToast(err.error || 'Error deleting debt', 'error');
      return;
    }

    showToast('Debt deleted and balance reversed');
    await loadDebts();
    await loadAccounts();
  } catch (error) {
    console.error('Delete debt error:', error);
    showToast('Failed to delete debt', 'error');
  }
}

/**
 * Load accounts from API (for balance updates after debt creation)
 */
async function loadAccounts() {
  try {
    const response = await fetch('/api/accounts');
    if (!response.ok) return;
    // Update UI with new balances if needed
    renderAccountsSection();
  } catch (error) {
    console.error('Load accounts error:', error);
  }
}

/**
 * Export records as CSV
 */
function exportRecordsCSV() {
  window.location.href = '/api/records/export';
}

function submitPlan(e, kind, editId) {
  e.preventDefault();
  const raw  = Object.fromEntries(new FormData(e.target));
  // Parse numeric fields
  const numFields = { budget:['limit'], savings:['target','saved'], debt:['total','paid','interest_rate'] };
  const data = { ...raw, id: editId || Date.now() };
  (numFields[kind] || []).forEach(k => { if (raw[k] !== '') data[k] = parseFloat(raw[k]) || 0; });

  const stores = { budget: budgets, savings: savingsGoals, debt: debts };
  const arr    = stores[kind];
  if (editId) {
    const i = arr.findIndex(x => x.id === editId);
    if (i >= 0) arr[i] = { ...arr[i], ...data };
  } else {
    arr.push(data);
  }

  // DEBT → credit borrowed amount as income to chosen account (LEGACY - now handled by API)
  // This section is kept for backward compatibility with local storage debt operations
  if (kind === 'debt' && !editId) {
    const amt = parseFloat(data.total) || 0;
    const acc = data.account || 'card';
    if (amt > 0) {
      transactions.push({
        id: Date.now() + 10,
        text: `Loan received: ${data.name}`,
        amount: amt,
        account: acc,
        category: 'Loan',
        date: data.due_date || today()
      });
      save();
      render();
      renderAccountsSection();
      renderIncomeSection();
      // Check if pending expense can now be covered
      if (_pendingExpense && _pendingExpense.account === acc) {
        const newBal = getAccountBalance(acc);
        if (newBal >= _pendingExpense.amount) {
          showToast(
            `${ACC_NAMES[acc]} balance is now $${newBal.toFixed(2)} — go add your $${_pendingExpense.amount.toFixed(2)} expense ✓`
          );
          document.getElementById('debtReminder').style.display = 'none';
          _pendingExpense = null;
        }
      }
    }
  }

  saveLocal();
  if (kind === 'budget')  { renderBudgetSection();  renderDashWidgets(); }
  if (kind === 'savings') { renderSavingsSection(); renderDashWidgets(); }
  if (kind === 'debt')    { renderDebtSection();    renderDashWidgets(); }
  closeModal();
  showToast(editId ? 'Updated!' : 'Created!');
}

// ─── DELETE ───
function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  save(); render(); renderAccountsSection();
  renderIncomeSection(); renderExpenseSection();
  showToast('Deleted');
}

/**
 * Delete transfer record
 * Note: Ensures delete button is properly wired in transfer table
 */
function deleteTransferRecord(id) {
  // Remove the pair of transactions + the transfer record
  transfers = transfers.filter(t => t.id !== id);
  // Also remove the two transaction entries created for this transfer
  transactions = transactions.filter(t => t.id !== id - 2 && t.id !== id - 1);
  save(); saveLocal(); render(); renderAccountsSection(); renderTransferSection();
  showToast('Transfer deleted');
}

function deletePlan(kind, id) {
  if (kind === 'budget')  budgets      = budgets.filter(x => x.id !== id);
  if (kind === 'savings') savingsGoals = savingsGoals.filter(x => x.id !== id);
  if (kind === 'debt')    {
    if (debts.some(d => d.id === id)) {
      // If debt is from API, use API delete
      deleteDebtAPI(id);
      return;
    }
    debts = debts.filter(x => x.id !== id);
  }
  saveLocal();
  if (kind === 'budget')  { renderBudgetSection();  renderDashWidgets(); }
  if (kind === 'savings') { renderSavingsSection(); renderDashWidgets(); }
  if (kind === 'debt')    { renderDebtSection();    renderDashWidgets(); }
  showToast('Deleted');
}

// ─── SECTION RENDERERS ───
function renderAccountsSection() {
  const accs = ['card','cash','savings'];
  accs.forEach(acc => {
    const txs = transactions.filter(t => t.account === acc);
    const bal  = txs.reduce((s,t) => s + t.amount, 0);
    const inc  = txs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const exp  = txs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    setEl(acc+'BalFull', '$' + Math.max(bal,0).toFixed(2));
    setEl(acc+'Income',  '$' + inc.toFixed(2));
    setEl(acc+'Expense', '$' + exp.toFixed(2));
    // mini cards on dashboard
    setEl(acc==='savings'?'savAccBal':acc+'Bal', '$' + Math.max(bal,0).toFixed(2));
  });
  const net = transactions.reduce((s,t)=>s+t.amount,0);
  setEl('totalBal', '$' + Math.max(net,0).toFixed(2));
}

function renderIncomeSection() {
  const data  = getFiltered().filter(t => t.amount > 0);
  const tbody = document.getElementById('income-tbody');
  setEl('incomeTotal', '$' + data.reduce((s,t)=>s+t.amount,0).toFixed(2));
  setEl('incomeCount', data.length);
  tbody.innerHTML = data.map(t => `<tr>
    <td>${t.text}</td>
    <td><span class="badge-acc">${ACC_LABELS[t.account]||t.account}</span></td>
    <td><span class="badge-cat income-tag">${t.category}</span></td>
    <td style="color:var(--green);font-weight:600">+$${t.amount.toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date}</td>
    <td class="td-actions">
      <button class="action-btn" onclick="openTxModal('income',${JSON.stringify(t).replace(/"/g,'&quot;')})">✎</button>
      <button class="action-btn del" onclick="deleteTx(${t.id})">✕</button>
    </td></tr>`).join('');
  document.getElementById('income-empty').style.display = data.length ? 'none' : 'block';
}

function renderExpenseSection() {
  const data  = getFiltered().filter(t => t.amount < 0);
  const tbody = document.getElementById('expense-tbody');
  setEl('expenseTotal', '$' + data.reduce((s,t)=>s+Math.abs(t.amount),0).toFixed(2));
  setEl('expenseCount', data.length);
  tbody.innerHTML = data.map(t => `<tr>
    <td>${t.text}</td>
    <td><span class="badge-acc">${ACC_LABELS[t.account]||t.account}</span></td>
    <td><span class="badge-cat expense-tag">${t.category}</span></td>
    <td style="color:var(--red);font-weight:600">−$${Math.abs(t.amount).toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date}</td>
    <td class="td-actions">
      <button class="action-btn" onclick="openTxModal('expense',${JSON.stringify({...t,amount:Math.abs(t.amount)}).replace(/"/g,'&quot;')})">✎</button>
      <button class="action-btn del" onclick="deleteTx(${t.id})">✕</button>
    </td></tr>`).join('');
  document.getElementById('expense-empty').style.display = data.length ? 'none' : 'block';
}

function renderTransferSection() {
  const tbody = document.getElementById('transfer-tbody');
  setEl('transferTotal', '$' + transfers.reduce((s,t)=>s+(parseFloat(t.amount)||0),0).toFixed(2));
  setEl('transferCount', transfers.length);
  tbody.innerHTML = transfers.map(t => `<tr>
    <td>${t.note||'—'}</td>
    <td><span class="badge-acc">${ACC_LABELS[t.from]||t.from}</span></td>
    <td><span class="badge-acc">${ACC_LABELS[t.to]||t.to}</span></td>
    <td style="color:var(--blue);font-weight:600">$${parseFloat(t.amount).toFixed(2)}</td>
    <td style="color:var(--text-muted)">${t.date||'—'}</td>
    <td class="td-actions">
      <button class="action-btn del" onclick="deleteTransferRecord(${t.id})">✕</button>
    </td></tr>`).join('');
  document.getElementById('transfer-empty').style.display = transfers.length ? 'none' : 'block';
}

function renderBudgetSection() {
  const el      = document.getElementById('budget-cards');
  const expData = getFiltered().filter(t => t.amount < 0);
  let totalB = 0, totalS = 0;
  el.innerHTML = budgets.map(b => {
    const spent = expData.filter(t=>t.category===b.category).reduce((s,t)=>s+Math.abs(t.amount),0);
    const pct   = b.limit > 0 ? Math.min(Math.round(spent/b.limit*100),100) : 0;
    const rem   = b.limit - spent;
    const sc    = pct>=100?'danger':pct>=80?'warn':'ok';
    totalB += b.limit; totalS += spent;
    return planCard(b,'budget',
      `<span class="planning-badge ${sc}">${pct>=100?'At limit':pct>=80?'Near limit':'On track'}</span>`,
      `<span style="color:var(--red)">$${spent.toFixed(2)} spent</span><span style="color:var(--text-muted)">of $${b.limit.toFixed(2)}</span>`,
      pct, sc, `${rem>=0?'$'+rem.toFixed(2)+' remaining':'$'+Math.abs(rem).toFixed(2)+' over'} · ${b.period||'monthly'}`
    );
  }).join('');
  setEl('budgetTotal',     '$' + totalB.toFixed(2));
  setEl('budgetRemaining', '$' + Math.max(totalB-totalS,0).toFixed(2));
  document.getElementById('budget-empty').style.display = budgets.length ? 'none' : 'block';
}

function renderSavingsSection() {
  const el    = document.getElementById('savings-cards');
  const total = savingsGoals.reduce((s,g)=>s+(parseFloat(g.saved)||0),0);
  setEl('savingsTotal', '$' + total.toFixed(2));
  setEl('savingsCount', savingsGoals.length);
  setEl('dashSaved',    total.toFixed(2));
  el.innerHTML = savingsGoals.map(g => {
    const saved  = parseFloat(g.saved)||0;
    const target = parseFloat(g.target)||0;
    const pct    = target > 0 ? Math.min(Math.round(saved/target*100),100) : 0;
    return planCard(g,'savings',
      `<span class="planning-badge ${pct>=100?'ok':'info'}">${pct>=100?'Complete':pct+'%'}</span>`,
      `<span style="color:var(--gold)">$${saved.toFixed(2)} saved</span><span style="color:var(--text-muted)">of $${target.toFixed(2)}</span>`,
      pct, 'gold-bar', g.target_date?`Target: ${g.target_date}`:'No target date'
    );
  }).join('');
  document.getElementById('savings-empty').style.display = savingsGoals.length ? 'none' : 'block';
}

function renderDebtSection() {
  const el    = document.getElementById('debt-cards');
  const totalOwed = debts.reduce((s,d)=>s+(parseFloat(d.total_amount||d.total||0))-(parseFloat(d.remaining_amount||d.paid||0)),0);
  const totalPaid = debts.reduce((s,d)=>s+(parseFloat(d.total_amount||d.total||0))-(parseFloat(d.remaining_amount||d.paid||0)),0);
  setEl('debtTotal', '$' + Math.max(totalOwed,0).toFixed(2));
  setEl('debtPaid',  '$' + totalPaid.toFixed(2));
  el.innerHTML = debts.map(d => {
    const total = parseFloat(d.total_amount || d.total || 0);
    const remaining = parseFloat(d.remaining_amount || d.paid || 0);
    const paid = total - remaining;
    const pct   = total > 0 ? Math.min(Math.round(paid/total*100),100) : 0;
    const done  = pct >= 100;
    const sc    = done?'ok':pct>=50?'warn':'danger';
    return planCard(d,'debt',
      `<span class="planning-badge ${sc}">${done?'Paid off':pct+'% paid'}</span>`,
      `<span style="color:var(--green)">$${paid.toFixed(2)} paid</span><span style="color:var(--text-muted)">of $${total.toFixed(2)}</span>`,
      pct, done?'ok':'danger',
      `${done?'Fully paid!':'$'+remaining.toFixed(2)+' left'}${d.due_date?' · Due '+d.due_date:''}`
    );
  }).join('');
  document.getElementById('debt-empty').style.display = debts.length ? 'none' : 'block';
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

function renderDashWidgets() {
  const expData = getFiltered().filter(t => t.amount < 0);
  const bl = document.getElementById('dashBudgetList');
  bl.innerHTML = budgets.length ? budgets.slice(0,4).map(b => {
    const spent = expData.filter(t=>t.category===b.category).reduce((s,t)=>s+Math.abs(t.amount),0);
    const pct = b.limit>0?Math.min(Math.round(spent/b.limit*100),100):0;
    return `<div class="widget-row"><span class="widget-label">${b.category}</span><div class="prog-track sm"><div class="prog-bar ${pct>=100?'danger':pct>=80?'warn':'ok'}" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No budgets. <button class="inline-link" onclick="navTo('budget')">Add →</button></div>`;

  const sl = document.getElementById('dashSavingsList');
  sl.innerHTML = savingsGoals.length ? savingsGoals.slice(0,3).map(g => {
    const pct = g.target>0?Math.min(Math.round((g.saved/g.target)*100),100):0;
    return `<div class="widget-row"><span class="widget-label">${g.name}</span><div class="prog-track sm"><div class="prog-bar gold-bar" style="width:${pct}%"></div></div><span class="widget-val">${pct}%</span></div>`;
  }).join('') : `<div class="widget-empty">No goals. <button class="inline-link" onclick="navTo('savings')">Create →</button></div>`;

  const dl = document.getElementById('dashDebtList');
  dl.innerHTML = debts.length ? debts.slice(0,3).map(d => {
    const total = parseFloat(d.total_amount || d.total || 0);
    const remaining = parseFloat(d.remaining_amount || d.paid || 0);
    const pct = total>0?Math.min(Math.round(((total-remaining)/total)*100),100):0;
    return `<div class="widget-row"><span class="widget-label">${d.creditor_name || d.name}</span><div class="prog-track sm"><div class="prog-bar danger" style="width:${Math.max(100-pct,0)}%"></div></div><span class="widget-val">$${remaining.toFixed(0)} left</span></div>`;
  }).join('') : `<div class="widget-empty">No debts. <button class="inline-link" onclick="navTo('debt')">Add →</button></div>`;
}

// ─── MAIN RENDER ───
function getFiltered() {
  const m = document.getElementById('monthFilter').value;
  return m ? transactions.filter(t => t.date && t.date.startsWith(m)) : transactions;
}

const ICONS = {
  'Salary':        '<i class="fa-solid fa-briefcase"></i>',
  'Business':      '<i class="fa-solid fa-building"></i>',
  'Investment':    '<i class="fa-solid fa-chart-line"></i>',
  'Freelance':     '<i class="fa-solid fa-laptop-code"></i>',
  'Bonus':         '<i class="fa-solid fa-gift"></i>',
  'Food':          '<i class="fa-solid fa-utensils"></i>',
  'Transport':     '<i class="fa-solid fa-car"></i>',
  'Entertainment': '<i class="fa-solid fa-film"></i>',
  'Bills':         '<i class="fa-solid fa-file-invoice"></i>',
  'Shopping':      '<i class="fa-solid fa-bag-shopping"></i>',
  'Health':        '<i class="fa-solid fa-heart-pulse"></i>',
  'Debt':          '<i class="fa-solid fa-credit-card"></i>',
  'Loan':          '<i class="fa-solid fa-hand-holding-dollar"></i>',
  'Transfer':      '<i class="fa-solid fa-right-left"></i>',
  'Other':         '<i class="fa-solid fa-circle-dot"></i>',
};
function catIcon(cat) { return ICONS[cat] || '<i class="fa-solid fa-circle-dot"></i>'; }

function render() {
  const data = getFiltered();
  const list = document.getElementById('list');
  list.innerHTML = '';
  let bal = 0, inc = 0, exp = 0;
  data.forEach(t => {
    bal += t.amount;
    t.amount > 0 ? (inc += t.amount) : (exp += t.amount);
    const el = document.createElement('div');
    el.className = `tx-item ${t.amount>0?'plus':'minus'}`;
    el.innerHTML = `
      <div class="tx-icon">${catIcon(t.category)}</div>
      <div class="tx-info">
        <div class="tx-name">${t.text}</div>
        <div class="tx-meta">${ACC_LABELS[t.account]||t.account} · ${t.category} · ${t.date}</div>
      </div>
      <div class="tx-amount">${t.amount>0?'+':'−'}$${Math.abs(t.amount).toFixed(2)}</div>
      <button class="tx-del" onclick="deleteTx(${t.id})">✕</button>`;
    list.appendChild(el);
  });

  document.getElementById('empty').style.display = data.length ? 'none' : 'block';
  setEl('txCount', `${data.length} item${data.length!==1?'s':''}`);

  // NEVER show negative on dashboard
  const safeBal = Math.max(bal, 0);
  setEl('balance',  safeBal.toFixed(2));
  setEl('balance2', safeBal.toFixed(2));
  setEl('income',   inc.toFixed(2));
  setEl('income2',  inc.toFixed(2));
  setEl('expense',  Math.abs(exp).toFixed(2));
  setEl('expense2', Math.abs(exp).toFixed(2));

  renderAccountsSection();
  renderDashWidgets();
  const saved = savingsGoals.reduce((s,g)=>s+(parseFloat(g.saved)||0),0);
  setEl('dashSaved', saved.toFixed(2));
}

// ─── QUICK ADD ───
document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('text').value.trim();
  const amt  = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;
  const acc  = document.getElementById('quickAccount').value;
  const cat  = document.getElementById('category').value;
  if (!text || !amt || !date || !acc || !cat) { showToast('Fill all fields','error'); return; }

  if (txType === 'expense') {
    const accBal = getAccountBalance(acc);
    if (amt > accBal) {
      showDebtDialog({ text, amount: amt, account: acc, category: cat, date });
      document.getElementById('form').reset(); setType('income'); return;
    }
  }

  const amount = txType === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  transactions.push({ id: Date.now(), text, amount, account: acc, category: cat, date });
  save(); render();
  document.getElementById('form').reset(); setType('income');
  showToast('Added!');
});

document.getElementById('form2').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('text2').value.trim();
  const amt  = parseFloat(document.getElementById('amount2').value);
  const date = document.getElementById('date2').value;
  const acc  = document.getElementById('account2').value;
  const cat  = document.getElementById('category2').value;
  if (!text || !amt || !date || !acc || !cat) { showToast('Fill all fields','error'); return; }

  if (txType2 === 'expense') {
    const accBal = getAccountBalance(acc);
    if (amt > accBal) {
      showDebtDialog({ text, amount: amt, account: acc, category: cat, date });
      document.getElementById('form2').reset(); setType2('income'); return;
    }
  }

  const amount = txType2 === 'expense' ? -Math.abs(amt) : Math.abs(amt);
  transactions.push({ id: Date.now(), text, amount, account: acc, category: cat, date });
  save(); render(); renderIncomeSection(); renderExpenseSection();
  document.getElementById('form2').reset(); setType2('income');
  showToast('Added!');
});

// ─── CATEGORIES ───
function setType(t)  { txType=t;  document.getElementById('incomeBtn').classList.toggle('active',t==='income');  document.getElementById('expenseBtn').classList.toggle('active',t==='expense');  loadCategories(); }
function setType2(t) { txType2=t; document.getElementById('incomeBtn2').classList.toggle('active',t==='income'); document.getElementById('expenseBtn2').classList.toggle('active',t==='expense'); loadCategories2(); }
function allCats(t)  { return t==='income'?[...defaultIncome,...customIncome]:[...defaultExpense,...customExpense]; }
function loadCategories()  { const s=document.getElementById('category');  s.innerHTML='<option value="">Select…</option>'; allCats(txType).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;s.appendChild(o);}); }
function loadCategories2() { const s=document.getElementById('category2'); s.innerHTML='<option value="">Select…</option>'; allCats(txType2).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;s.appendChild(o);}); }
function saveCategories() { localStorage.setItem('customIncome',JSON.stringify(customIncome)); localStorage.setItem('customExpense',JSON.stringify(customExpense)); }
document.getElementById('addCategoryBtn').onclick = () => { const v=document.getElementById('newCategory').value.trim(); if(!v)return; const a=txType==='income'?customIncome:customExpense; if(a.some(c=>c.toLowerCase()===v.toLowerCase())){showToast('Already exists','error');return;} a.push(v);saveCategories();document.getElementById('newCategory').value='';loadCategories();showToast(`"${v}" added`); };
function addCategoryFromForm2() { const v=document.getElementById('newCategory2').value.trim(); if(!v)return; const a=txType2==='income'?customIncome:customExpense; if(a.some(c=>c.toLowerCase()===v.toLowerCase())){showToast('Already exists','error');return;} a.push(v);saveCategories();document.getElementById('newCategory2').value='';loadCategories2();showToast(`"${v}" added`); }
function addCategory(t) { const id=t==='income'?'newIncomeCategory':'newExpenseCategory'; const v=document.getElementById(id).value.trim(); if(!v)return; const a=t==='income'?customIncome:customExpense; if(a.some(c=>c.toLowerCase()===v.toLowerCase())){showToast('Already exists','error');return;} a.push(v);saveCategories();document.getElementById(id).value='';renderCategoryChips();showToast(`"${v}" added`); }
function deleteCategory(cat,t) { if(t==='income')customIncome=customIncome.filter(c=>c!==cat); else customExpense=customExpense.filter(c=>c!==cat); saveCategories();loadCategories();loadCategories2();renderCategoryChips();showToast(`"${cat}" removed`); }
function renderCategoryChips() {
  const ie=document.getElementById('incomeCategoryChips'), ee=document.getElementById('expenseCategoryChips');
  ie.innerHTML=''; ee.innerHTML='';
  defaultIncome.forEach(c=>{const ch=document.createElement('div');ch.className='cat-chip default-chip';ch.textContent=c;ie.appendChild(ch);});
  customIncome.forEach(c=>{const ch=document.createElement('div');ch.className='cat-chip';ch.innerHTML=`${c}<button class="cat-chip-del" onclick="deleteCategory('${c}','income')">✕</button>`;ie.appendChild(ch);});
  defaultExpense.forEach(c=>{const ch=document.createElement('div');ch.className='cat-chip default-chip';ch.textContent=c;ee.appendChild(ch);});
  customExpense.forEach(c=>{const ch=document.createElement('div');ch.className='cat-chip';ch.innerHTML=`${c}<button class="cat-chip-del" onclick="deleteCategory('${c}','expense')">✕</button>`;ee.appendChild(ch);});
}

// ─── TABLE FILTER ───
function filterTbody(id, q) { document.querySelectorAll(`#${id} tr`).forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none'); }

// ─── CHARTS ───
function updateCharts() {
  const data=getFiltered(); const iT={},eT={};
  data.forEach(t=>{t.amount>0?(iT[t.category]=(iT[t.category]||0)+t.amount):(eT[t.category]=(eT[t.category]||0)+Math.abs(t.amount));});
  const CC=['#c9a84c','#5cba8a','#6a9fd8','#e05c5c','#b07cde','#e8a44a','#5cbab0','#de7ca4','#8aae5c','#c95c8a'];
  const hasI=Object.keys(iT).length>0, hasE=Object.keys(eT).length>0;
  document.getElementById('incomeChart').style.display=hasI?'block':'none';
  document.getElementById('incomeChartEmpty').style.display=hasI?'none':'block';
  document.getElementById('expenseChart').style.display=hasE?'block':'none';
  document.getElementById('expenseChartEmpty').style.display=hasE?'none':'block';
  if(incomeChart)incomeChart.destroy(); if(expenseChart)expenseChart.destroy();
  const opts=(labels,values)=>({type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:CC,borderColor:'#0e0e10',borderWidth:3,hoverOffset:6}]},options:{cutout:'68%',plugins:{legend:{position:'bottom',labels:{color:'#7a7870',font:{family:'DM Sans',size:12},padding:14,boxWidth:10,boxHeight:10}}}}});
  if(hasI)incomeChart=new Chart(document.getElementById('incomeChart'),opts(Object.keys(iT),Object.values(iT)));
  if(hasE)expenseChart=new Chart(document.getElementById('expenseChart'),opts(Object.keys(eT),Object.values(eT)));
  const rb=(cId,eId,totals)=>{const el=document.getElementById(cId),em=document.getElementById(eId);el.innerHTML='';const ks=Object.keys(totals);if(!ks.length){em.style.display='block';return;}em.style.display='none';const max=Math.max(...Object.values(totals));ks.forEach((k,i)=>{const p=Math.round(totals[k]/max*100);el.innerHTML+=`<div class="cat-row"><div class="cat-dot" style="background:${CC[i%CC.length]}"></div><div class="cat-name">${k}</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:${p}%;background:${CC[i%CC.length]}"></div></div><div class="cat-amount">$${totals[k].toFixed(2)}</div></div>`;});};
  rb('incomeCatBreakdown','incomeCatEmpty',iT); rb('expenseCatBreakdown','expenseCatEmpty',eT);
}

// ─── PERSIST ───
function save()      { localStorage.setItem('transactions', JSON.stringify(transactions)); }
function saveLocal() { localStorage.setItem('budgets',JSON.stringify(budgets)); localStorage.setItem('savingsGoals',JSON.stringify(savingsGoals)); localStorage.setItem('accTransfers',JSON.stringify(transfers)); }
function today()     { return new Date().toISOString().slice(0,10); }

document.getElementById('monthFilter').addEventListener('change', () => { render(); updateCharts(); });
document.getElementById('date').value   = today();
document.getElementById('date2').value  = today();
document.getElementById('tfDate').value = today();

// ─── INIT ───
loadCategories(); loadCategories2(); render(); loadDebts();
