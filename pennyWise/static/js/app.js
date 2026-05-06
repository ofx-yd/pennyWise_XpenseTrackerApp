// ─── DATA ───
let defaultIncome = ["Salary", "Business", "Investment", "Freelance", "Bonus"];
let defaultExpense = ["Food", "Transport", "Entertainment", "Bills", "Shopping", "Health"];
let customIncome = JSON.parse(localStorage.getItem("customIncome")) || [];
let customExpense = JSON.parse(localStorage.getItem("customExpense")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let type = "income";
let type2 = "income";
let incomeChart, expenseChart;

// Fix old data
transactions = transactions.map(t => ({
  ...t,
  category: t.category || "Other",
  date: t.date || new Date().toISOString().slice(0,10)
}));

// ─── USER ───
const email = localStorage.getItem("userEmail") || "";
const name = email ? email.split("@")[0] : "User";
document.getElementById("userName").textContent = name.charAt(0).toUpperCase() + name.slice(1);
document.getElementById("userEmailDisplay").textContent = email || "Guest";
document.getElementById("userAvatar").textContent = name.charAt(0).toUpperCase();

// ─── COLORS ───
const CHART_COLORS = [
  '#c9a84c','#5cba8a','#6a9fd8','#e05c5c','#b07cde',
  '#e8a44a','#5cbab0','#de7ca4','#8aae5c','#c95c8a'
];

// ─── NAV ───
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  btn.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    analytics: 'Analytics',
    categories: 'Categories',
    add: 'Add Transaction'
  };
  document.getElementById('pageTitle').textContent = titles[id] || id;

  if (id === 'analytics') updateCharts();
  if (id === 'categories') renderCategoryChips();
  if (id === 'transactions') renderTxList2();
  if (id === 'add') { loadCategories2(); }

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
  localStorage.removeItem("userEmail");
  window.location.href = "login.html";
}

// ─── TOAST ───
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '✗ ') + msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── TYPE TOGGLE ───
function setType(t) {
  type = t;
  document.getElementById('incomeBtn').classList.toggle('active', t === 'income');
  document.getElementById('expenseBtn').classList.toggle('active', t === 'expense');
  loadCategories();
}

function setType2(t) {
  type2 = t;
  document.getElementById('incomeBtn2').classList.toggle('active', t === 'income');
  document.getElementById('expenseBtn2').classList.toggle('active', t === 'expense');
  loadCategories2();
}

// ─── CATEGORIES ───
function allCats(t) {
  return t === 'income'
    ? [...defaultIncome, ...customIncome]
    : [...defaultExpense, ...customExpense];
}

function loadCategories() {
  const cats = allCats(type);
  const sel = document.getElementById('category');
  sel.innerHTML = '<option value="">Select category…</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

function loadCategories2() {
  const cats = allCats(type2);
  const sel = document.getElementById('category2');
  sel.innerHTML = '<option value="">Select category…</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

function saveCategories() {
  localStorage.setItem("customIncome", JSON.stringify(customIncome));
  localStorage.setItem("customExpense", JSON.stringify(customExpense));
}

document.getElementById('addCategoryBtn').onclick = () => {
  const val = document.getElementById('newCategory').value.trim();
  if (!val) return;
  const arr = type === 'income' ? customIncome : customExpense;
  if (arr.some(c => c.toLowerCase() === val.toLowerCase())) {
    showToast('Category already exists', 'error'); return;
  }
  arr.push(val);
  saveCategories();
  document.getElementById('newCategory').value = '';
  loadCategories();
  showToast(`"${val}" added to ${type} categories`);
};

function addCategoryFromForm2() {
  const val = document.getElementById('newCategory2').value.trim();
  if (!val) return;
  const arr = type2 === 'income' ? customIncome : customExpense;
  if (arr.some(c => c.toLowerCase() === val.toLowerCase())) {
    showToast('Category already exists', 'error'); return;
  }
  arr.push(val);
  saveCategories();
  document.getElementById('newCategory2').value = '';
  loadCategories2();
  showToast(`"${val}" added to ${type2} categories`);
}

function addCategory(t) {
  const inputId = t === 'income' ? 'newIncomeCategory' : 'newExpenseCategory';
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  const arr = t === 'income' ? customIncome : customExpense;
  if (arr.some(c => c.toLowerCase() === val.toLowerCase())) {
    showToast('Category already exists', 'error'); return;
  }
  arr.push(val);
  saveCategories();
  document.getElementById(inputId).value = '';
  renderCategoryChips();
  showToast(`"${val}" added`);
}

function deleteCategory(cat, t) {
  if (t === 'income') customIncome = customIncome.filter(c => c !== cat);
  else customExpense = customExpense.filter(c => c !== cat);
  saveCategories();
  loadCategories();
  loadCategories2();
  renderCategoryChips();
  showToast(`"${cat}" removed`);
}

function renderCategoryChips() {
  const incomeEl = document.getElementById('incomeCategoryChips');
  const expenseEl = document.getElementById('expenseCategoryChips');

  incomeEl.innerHTML = '';
  expenseEl.innerHTML = '';

  defaultIncome.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'cat-chip default-chip';
    chip.textContent = c;
    incomeEl.appendChild(chip);
  });

  customIncome.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.innerHTML = `${c}<button class="cat-chip-del" onclick="deleteCategory('${c}', 'income')">✕</button>`;
    incomeEl.appendChild(chip);
  });

  defaultExpense.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'cat-chip default-chip';
    chip.textContent = c;
    expenseEl.appendChild(chip);
  });

  customExpense.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.innerHTML = `${c}<button class="cat-chip-del" onclick="deleteCategory('${c}', 'expense')">✕</button>`;
    expenseEl.appendChild(chip);
  });
}

// ─── TRANSACTIONS ───
function getFiltered() {
  const m = document.getElementById('monthFilter').value;
  return m ? transactions.filter(t => t.date.startsWith(m)) : transactions;
}

const CATEGORY_ICONS = {
  'Salary':'💼','Business':'🏢','Investment':'📈','Freelance':'💻','Bonus':'🎁',
  'Food':'🍔','Transport':'🚗','Entertainment':'🎬','Bills':'🧾','Shopping':'🛍️',
  'Health':'🏥','Other':'📌'
};

function catIcon(cat) {
  return CATEGORY_ICONS[cat] || '📌';
}

function makeTxItem(t, onDelete) {
  const li = document.createElement('div');
  li.className = `tx-item ${t.amount > 0 ? 'plus' : 'minus'}`;

  const icon = document.createElement('div');
  icon.className = 'tx-icon';
  icon.textContent = catIcon(t.category);

  const info = document.createElement('div');
  info.className = 'tx-info';

  const name = document.createElement('div');
  name.className = 'tx-name';
  name.textContent = t.text;

  const meta = document.createElement('div');
  meta.className = 'tx-meta';
  meta.textContent = `${t.category} · ${t.date}`;

  info.appendChild(name);
  info.appendChild(meta);

  const amount = document.createElement('div');
  amount.className = 'tx-amount';
  amount.textContent = `${t.amount > 0 ? '+' : '−'}$${Math.abs(t.amount).toFixed(2)}`;

  const del = document.createElement('button');
  del.className = 'tx-del';
  del.textContent = '✕';
  del.onclick = onDelete;

  li.appendChild(icon);
  li.appendChild(info);
  li.appendChild(amount);
  li.appendChild(del);

  return li;
}

function render() {
  const data = getFiltered();
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  listEl.innerHTML = '';

  let balance = 0, income = 0, expense = 0;
  const incomeTotals = {}, expenseTotals = {};

  data.forEach(t => {
    balance += t.amount;
    if (t.amount > 0) {
      income += t.amount;
      incomeTotals[t.category] = (incomeTotals[t.category] || 0) + t.amount;
    } else {
      expense += t.amount;
      expenseTotals[t.category] = (expenseTotals[t.category] || 0) + Math.abs(t.amount);
    }
    const item = makeTxItem(t, () => deleteItem(t.id));
    listEl.appendChild(item);
  });

  emptyEl.style.display = data.length ? 'none' : 'block';
  document.getElementById('txCount').textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;

  document.getElementById('balance').textContent = Math.abs(balance).toFixed(2);
  document.getElementById('income').textContent = income.toFixed(2);
  document.getElementById('expense').textContent = Math.abs(expense).toFixed(2);

  // Update analytics numbers too
  document.getElementById('balance2').textContent = Math.abs(balance).toFixed(2);
  document.getElementById('income2').textContent = income.toFixed(2);
  document.getElementById('expense2').textContent = Math.abs(expense).toFixed(2);
}

function renderTxList2() {
  const data = getFiltered();
  const listEl = document.getElementById('list2');
  const emptyEl = document.getElementById('empty2');
  listEl.innerHTML = '';

  data.forEach(t => {
    const item = makeTxItem(t, () => deleteItem(t.id));
    listEl.appendChild(item);
  });

  emptyEl.style.display = data.length ? 'none' : 'block';
  document.getElementById('txCount2').textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;
}

function deleteItem(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  renderTxList2();
  showToast('Transaction deleted');
}

function save() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

// ─── FORM SUBMIT ───
document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  submitForm('text','amount','date','category', type);
});

document.getElementById('form2').addEventListener('submit', e => {
  e.preventDefault();
  submitForm('text2','amount2','date2','category2', type2);
  document.getElementById('form2').reset();
  setType2('income');
});

function submitForm(textId, amountId, dateId, catId, t) {
  const text = document.getElementById(textId).value.trim();
  let amount = parseFloat(document.getElementById(amountId).value);
  const category = document.getElementById(catId).value;
  const date = document.getElementById(dateId).value;

  if (!text || !amount || !category || !date) {
    showToast('Please fill all fields', 'error'); return;
  }

  amount = t === 'expense' ? -Math.abs(amount) : Math.abs(amount);

  transactions.push({ id: Date.now(), text, amount, category, date });
  save();
  render();
  renderTxList2();
  showToast('Transaction added!');

  // Reset only the quick-add form
  if (textId === 'text') {
    document.getElementById('form').reset();
    setType('income');
  }
}

// ─── CHARTS ───
function updateCharts() {
  const data = getFiltered();
  const incomeTotals = {}, expenseTotals = {};

  data.forEach(t => {
    if (t.amount > 0) {
      incomeTotals[t.category] = (incomeTotals[t.category] || 0) + t.amount;
    } else {
      expenseTotals[t.category] = (expenseTotals[t.category] || 0) + Math.abs(t.amount);
    }
  });

  const hasIncome = Object.keys(incomeTotals).length > 0;
  const hasExpense = Object.keys(expenseTotals).length > 0;

  // Income chart
  document.getElementById('incomeChart').style.display = hasIncome ? 'block' : 'none';
  document.getElementById('incomeChartEmpty').style.display = hasIncome ? 'none' : 'block';

  if (incomeChart) incomeChart.destroy();
  if (hasIncome) {
    incomeChart = new Chart(document.getElementById('incomeChart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(incomeTotals),
        datasets: [{
          data: Object.values(incomeTotals),
          backgroundColor: CHART_COLORS,
          borderColor: '#0e0e10',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#7a7870', font: { family: 'DM Sans', size: 12 }, padding: 14, boxWidth: 10, boxHeight: 10 }
          }
        }
      }
    });
  }

  // Expense chart
  document.getElementById('expenseChart').style.display = hasExpense ? 'block' : 'none';
  document.getElementById('expenseChartEmpty').style.display = hasExpense ? 'none' : 'block';

  if (expenseChart) expenseChart.destroy();
  if (hasExpense) {
    expenseChart = new Chart(document.getElementById('expenseChart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(expenseTotals),
        datasets: [{
          data: Object.values(expenseTotals),
          backgroundColor: CHART_COLORS,
          borderColor: '#0e0e10',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#7a7870', font: { family: 'DM Sans', size: 12 }, padding: 14, boxWidth: 10, boxHeight: 10 }
          }
        }
      }
    });
  }

  // Category breakdowns
  renderCatBreakdown('incomeCatBreakdown','incomeCatEmpty', incomeTotals, CHART_COLORS, 'income');
  renderCatBreakdown('expenseCatBreakdown','expenseCatEmpty', expenseTotals, CHART_COLORS, 'expense');
}

function renderCatBreakdown(containerId, emptyId, totals, colors, type) {
  const el = document.getElementById(containerId);
  const emptyEl = document.getElementById(emptyId);
  el.innerHTML = '';
  const keys = Object.keys(totals);
  if (!keys.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  const max = Math.max(...Object.values(totals));
  keys.forEach((k, i) => {
    const pct = Math.round((totals[k] / max) * 100);
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <div class="cat-dot" style="background:${colors[i % colors.length]}"></div>
      <div class="cat-name">${k}</div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
      <div class="cat-amount">$${totals[k].toFixed(2)}</div>
    `;
    el.appendChild(row);
  });
}

// ─── MONTH FILTER ───
document.getElementById('monthFilter').addEventListener('change', () => {
  render();
  renderTxList2();
  updateCharts();
});

// ─── SET TODAY'S DATE ───
document.getElementById('date').value = new Date().toISOString().slice(0,10);
document.getElementById('date2').value = new Date().toISOString().slice(0,10);

// ─── INIT ───
loadCategories();
loadCategories2();
render();
