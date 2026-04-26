const form = document.getElementById("form");
const textInput = document.getElementById("text");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const monthFilter = document.getElementById("monthFilter");

const newCategoryInput = document.getElementById("newCategory");
const addCategoryBtn = document.getElementById("addCategoryBtn");

const incomeCategoryList = document.getElementById("incomeCategoryList");
const expenseCategoryList = document.getElementById("expenseCategoryList");

const list = document.getElementById("list");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");

const incomeCategoriesDiv = document.getElementById("incomeCategories");
const expenseCategoriesDiv = document.getElementById("expenseCategories");

const emptyEl = document.getElementById("empty");

const incomeBtn = document.getElementById("incomeBtn");
const expenseBtn = document.getElementById("expenseBtn");

let defaultIncome = ["Salary", "Business", "Investment"];
let defaultExpense = ["Food", "Transport", "Entertainment", "Bills"];

let customIncome = JSON.parse(localStorage.getItem("customIncome")) || [];
let customExpense = JSON.parse(localStorage.getItem("customExpense")) || [];

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

let type = "income";
let incomeChart, expenseChart;

/* FIX OLD DATA */
transactions = transactions.map(t => ({
    ...t,
    category: t.category || "Other",
    date: t.date || new Date().toISOString().slice(0,10)
}));

/* TOGGLE */
incomeBtn.onclick = () => {
    type = "income";
    incomeBtn.classList.add("active");
    expenseBtn.classList.remove("active");
    loadCategories();
};

expenseBtn.onclick = () => {
    type = "expense";
    expenseBtn.classList.add("active");
    incomeBtn.classList.remove("active");
    loadCategories();
};

/* LOAD CATEGORIES */
function loadCategories() {
    const cats = type === "income"
        ? [...defaultIncome, ...customIncome]
        : [...defaultExpense, ...customExpense];

    categoryInput.innerHTML = '<option value="">Select category</option>';

    cats.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        categoryInput.appendChild(opt);
    });
}

/* SAVE CATEGORIES */
function saveCategories() {
    localStorage.setItem("customIncome", JSON.stringify(customIncome));
    localStorage.setItem("customExpense", JSON.stringify(customExpense));
}

/* ADD CATEGORY */
addCategoryBtn.onclick = () => {
    const val = newCategoryInput.value.trim();
    if (!val) return;

    const list = type === "income" ? customIncome : customExpense;

    if (list.some(c => c.toLowerCase() === val.toLowerCase())) return;

    list.push(val);
    saveCategories();

    newCategoryInput.value = "";
    loadCategories();
    renderCategoryManager();
};

/* DELETE CATEGORY */
function deleteCategory(cat, t) {
    if (t === "income") {
        customIncome = customIncome.filter(c => c !== cat);
    } else {
        customExpense = customExpense.filter(c => c !== cat);
    }

    saveCategories();
    loadCategories();
    renderCategoryManager();
}

/* CATEGORY MANAGER */
function renderCategoryManager() {
    incomeCategoryList.innerHTML = "";
    expenseCategoryList.innerHTML = "";

    customIncome.forEach(c => {
        const li = document.createElement("li");
        li.textContent = c;

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.onclick = () => deleteCategory(c, "income");

        li.appendChild(btn);
        incomeCategoryList.appendChild(li);
    });

    customExpense.forEach(c => {
        const li = document.createElement("li");
        li.textContent = c;

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.onclick = () => deleteCategory(c, "expense");

        li.appendChild(btn);
        expenseCategoryList.appendChild(li);
    });
}

/* ADD TRANSACTION */
form.addEventListener("submit", e => {
    e.preventDefault();

    const text = textInput.value.trim();
    let amount = parseFloat(amountInput.value);
    const category = categoryInput.value;
    const date = dateInput.value;

    if (!text || !amount || !category || !date) return;

    amount = type === "expense" ? -Math.abs(amount) : Math.abs(amount);

    transactions.push({
        id: Date.now(),
        text,
        amount,
        category,
        date
    });

    save();
    render();
    form.reset();
});

/* FILTER */
function getFiltered() {
    const m = monthFilter.value;
    if (!m) return transactions;
    return transactions.filter(t => t.date.startsWith(m));
}

/* RENDER */
function render() {
    const data = getFiltered();

    list.innerHTML = "";

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

        const li = document.createElement("li");
        li.className = t.amount > 0 ? "plus" : "minus";
        li.innerHTML = `${t.text} (${t.date}) [$${Math.abs(t.amount)}]`;

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.onclick = () => deleteItem(t.id);

        li.appendChild(btn);
        list.appendChild(li);
    });

    emptyEl.style.display = data.length ? "none" : "block";

    balanceEl.textContent = balance.toFixed(2);
    incomeEl.textContent = income.toFixed(2);
    expenseEl.textContent = Math.abs(expense).toFixed(2);

    incomeCategoriesDiv.innerHTML = "";
    Object.keys(incomeTotals).forEach(k => {
        const p = document.createElement("p");
        p.textContent = `${k}: $${incomeTotals[k].toFixed(2)}`;
        incomeCategoriesDiv.appendChild(p);
    });

    expenseCategoriesDiv.innerHTML = "";
    Object.keys(expenseTotals).forEach(k => {
        const p = document.createElement("p");
        p.textContent = `${k}: $${expenseTotals[k].toFixed(2)}`;
        expenseCategoriesDiv.appendChild(p);
    });

    updateCharts(incomeTotals, expenseTotals);
}

/* DELETE TRANSACTION */
function deleteItem(id) {
    transactions = transactions.filter(t => t.id !== id);
    save();
    render();
}

/* SAVE */
function save() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

/* CHARTS */
function updateCharts(incomeTotals, expenseTotals) {
    if (incomeChart) incomeChart.destroy();
    if (expenseChart) expenseChart.destroy();

    incomeChart = new Chart(document.getElementById("incomeChart"), {
        type: "doughnut",
        data: {
            labels: Object.keys(incomeTotals),
            datasets: [{ data: Object.values(incomeTotals) }]
        }
    });

    expenseChart = new Chart(document.getElementById("expenseChart"), {
        type: "doughnut",
        data: {
            labels: Object.keys(expenseTotals),
            datasets: [{ data: Object.values(expenseTotals) }]
        }
    });
}

/* EVENTS */
monthFilter.addEventListener("change", render);

/* INIT */
loadCategories();
renderCategoryManager();
render();