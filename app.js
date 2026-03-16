const USERS = {
  admin: { password: 'admin123', role: 'edit' },
  viewer: { password: 'viewer123', role: 'view' }
};

let state = JSON.parse(localStorage.getItem('dashState') || '{"projects":[],"session":null}');
let statusChart, financeChart, projectProgressChart;
let selectedProjectId = null;

const byId = (id) => document.getElementById(id);
const formatMoney = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function saveState() {
  localStorage.setItem('dashState', JSON.stringify(state));
}

function calcFinancials(project) {
  const total = +project.totalValue || 0;
  const cogs = +project.cogs || 0;
  const op = +project.operationalCost || 0;
  const other = +project.otherExpenses || 0;
  project.grossProfit = total - cogs;
  project.ebitda = project.grossProfit - op;
  project.netProfit = project.ebitda - other;
  const pending = total - (+project.paymentReceived || 0) - (+project.cashReceived || 0);
  project.pendingAmount = pending;
  project.billingRatio = `${project.billingCompletion || 0}% : ${(100 - (+project.billingCompletion || 0)).toFixed(0)}%`;
}

function projectDelayStatus(project) {
  if (!project.deadline) return '';
  const d = new Date(project.deadline);
  const now = new Date(today());
  if ((project.status || '') !== 'Completed' && d < now) return '⚠️ Delayed';
  return '';
}

function renderDashboard() {
  const statuses = ['Active', 'Completed', 'Running', 'Progress', 'On Hold'];
  const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
  state.projects.forEach((p) => counts[p.status] = (counts[p.status] || 0) + 1);
  byId('statusCards').innerHTML = [`<div class="stat"><strong>Total</strong><br>${state.projects.length}</div>`, ...statuses.map((s) => `<div class="stat"><strong>${s}</strong><br>${counts[s] || 0}</div>`)].join('');

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(byId('statusChart'), {
    type: 'bar',
    data: { labels: statuses, datasets: [{ label: 'Projects', data: statuses.map((s) => counts[s] || 0) }] }
  });

  const totalValue = state.projects.reduce((a, p) => a + (+p.totalValue || 0), 0);
  const totalNet = state.projects.reduce((a, p) => a + (+p.netProfit || 0), 0);
  const totalPending = state.projects.reduce((a, p) => a + (+p.pendingAmount || 0), 0);
  if (financeChart) financeChart.destroy();
  financeChart = new Chart(byId('financeChart'), {
    type: 'doughnut',
    data: {
      labels: ['Project Value', 'Net Profit', 'Pending'],
      datasets: [{ data: [totalValue, totalNet, totalPending] }]
    }
  });
}

function renderProjectList() {
  const q = byId('projectSearch').value?.toLowerCase() || '';
  byId('projectList').innerHTML = state.projects
    .filter((p) => (p.projectName || '').toLowerCase().includes(q))
    .map((p) => `<div class="project-item ${p.id === selectedProjectId ? 'active' : ''}" data-id="${p.id}"><strong>${p.projectName || 'Untitled'}</strong><br><small>${p.status || '-'} ${projectDelayStatus(p)}</small></div>`)
    .join('') || '<div class="empty">No projects yet.</div>';

  document.querySelectorAll('.project-item').forEach((el) => el.onclick = () => {
    selectedProjectId = el.dataset.id;
    renderProjectList();
    renderProjectForm();
  });
}

function defaultProject() {
  return {
    id: crypto.randomUUID(),
    projectName: '', billingName: '', clientName: '', address: '', contactPerson: '', mobile: '', gst: '', startDate: today(), deadline: today(),
    totalValue: 0, paymentReceived: 0, cashReceived: 0, pendingAmount: 0, status: 'Active', engineerName: '', engineerTeam: '', contractorName: '', contractorTeam: '',
    cogs: 0, operationalCost: 0, otherExpenses: 0, grossProfit: 0, ebitda: 0, netProfit: 0, billingCompletion: 0, billingRatio: '0% : 100%', generalRemarks: '',
    phases: [], payments: [], expenses: [], docs: []
  };
}

function rowInput(value, data = '') { return `<input value="${value ?? ''}" data-row="${data}" />`; }

function renderTable(rows, columns, tableId) {
  return `<table id="${tableId}"><thead><tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function phaseDelay(phase) {
  if (!phase.endDate) return '';
  return new Date(phase.endDate) < new Date(today()) && phase.status !== 'Completed' ? 'Delayed' : '';
}

function renderProjectForm() {
  const container = byId('projectContainer');
  const p = state.projects.find((x) => x.id === selectedProjectId);
  if (!p) { container.innerHTML = '<div class="empty">Select or create a project.</div>'; return; }
  calcFinancials(p);

  const tpl = byId('projectTemplate').content.cloneNode(true);
  container.innerHTML = '';
  container.appendChild(tpl);

  container.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    if (el.type !== 'file') el.value = p[field] ?? '';
    el.oninput = () => {
      if (el.type === 'number') p[field] = Number(el.value || 0); else if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') p[field] = el.value;
      calcFinancials(p);
      if (['totalValue','cogs','operationalCost','otherExpenses','paymentReceived','cashReceived','billingCompletion'].includes(field)) renderProjectForm();
    };
    if (el.type === 'file') {
      el.onchange = () => p.docs = [...p.docs, ...[...el.files].map((f) => f.name)];
    }
  });

  byId('phaseCount').textContent = `${p.phases.length}/200 phases`;
  const phaseRows = p.phases.map((ph, i) => `<tr>
      <td>${rowInput(ph.phaseName, `phaseName|${i}`)}</td>
      <td><input type="date" value="${ph.startDate || ''}" data-row="startDate|${i}"/></td>
      <td><input type="date" value="${ph.endDate || ''}" data-row="endDate|${i}"/></td>
      <td>${rowInput(ph.dueDays || 0, `dueDays|${i}`)}</td>
      <td>${rowInput(ph.alerts || '', `alerts|${i}`)}</td>
      <td><select data-row="status|${i}"><option ${ph.status==='Pending'?'selected':''}>Pending</option><option ${ph.status==='Running'?'selected':''}>Running</option><option ${ph.status==='Completed'?'selected':''}>Completed</option></select> ${phaseDelay(ph)}</td>
      <td>${rowInput(ph.remarks || '', `remarks|${i}`)}</td>
      <td><label><input type="checkbox" data-row="measurementDone|${i}" ${ph.measurementDone ? 'checked' : ''}/> Measured</label></td>
      <td><input type="file" data-row="phaseDoc|${i}" accept="application/pdf,image/*"/></td>
    </tr>`);
  container.querySelector('#phaseTableWrap').innerHTML = renderTable(phaseRows, ['Phase Name', 'Start', 'End', 'Due Days', 'Alerts', 'Status', 'Remarks', 'Measurement', 'Upload'], 'phaseTable');

  const payRows = p.payments.map((pm, i) => `<tr>
      <td>${rowInput(pm.mode || '', `mode|${i}|pay`)}</td><td><input type="date" value="${pm.date || ''}" data-row="date|${i}|pay"/></td><td>${rowInput(pm.amount || 0, `amount|${i}|pay`)}</td><td>${rowInput(pm.remarks || '', `remarks|${i}|pay`)}</td>
    </tr>`);
  container.querySelector('#paymentTableWrap').innerHTML = renderTable(payRows, ['Payment Mode', 'Payment Date', 'Payment Amount', 'Remarks'], 'paymentTable');

  const expRows = p.expenses.map((ex, i) => `<tr><td>${rowInput(ex.category || '', `category|${i}|exp`)}</td><td>${rowInput(ex.amount || 0, `amount|${i}|exp`)}</td><td>${rowInput(ex.remarks || '', `remarks|${i}|exp`)}</td></tr>`);
  container.querySelector('#expenseTableWrap').innerHTML = renderTable(expRows, ['Expense Category', 'Amount', 'Remarks'], 'expenseTable');

  container.querySelectorAll('[data-action]').forEach((btn) => btn.onclick = () => handleAction(btn.dataset.action, p));

  container.querySelectorAll('[data-row]').forEach((el) => {
    el.oninput = () => updateRowData(p, el);
    if (el.type === 'checkbox') el.onchange = () => updateRowData(p, el);
    if (el.type === 'file') el.onchange = () => {
      const [, i] = el.dataset.row.split('|');
      p.phases[i].files = [...(p.phases[i].files || []), ...[...el.files].map((f) => f.name)];
      saveState();
    };
  });

  initQr(p);
  renderProjectCharts(p);

  const role = state.session?.role;
  if (role !== 'edit') {
    container.querySelectorAll('input,textarea,select,button').forEach((el) => el.disabled = true);
  }
}

function updateRowData(project, el) {
  const [field, idx, type] = el.dataset.row.split('|');
  const target = type === 'pay' ? project.payments : type === 'exp' ? project.expenses : project.phases;
  if (!target[idx]) return;
  target[idx][field] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value || 0) : el.value);
  if (!type) {
    const ph = target[idx];
    if (ph.endDate && ph.startDate) ph.dueDays = Math.max(0, Math.ceil((new Date(ph.endDate) - new Date(ph.startDate)) / 86400000));
  }
  if (type === 'exp') project.otherExpenses = project.expenses.reduce((a, x) => a + (+x.amount || 0), 0);
  calcFinancials(project);
  saveState();
}

function handleAction(action, p) {
  if (action === 'addPhase') {
    if (p.phases.length >= 200) return alert('Maximum 200 phases reached');
    p.phases.push({ phaseName: '', startDate: today(), endDate: today(), dueDays: 0, alerts: '', status: 'Pending', remarks: '', measurementDone: false, files: [] });
  }
  if (action === 'addPayment') p.payments.push({ mode: '', date: today(), amount: 0, remarks: '' });
  if (action === 'addExpense') p.expenses.push({ category: '', amount: 0, remarks: '' });
  if (action === 'save') alert('Project saved');
  if (action === 'delete') {
    if (confirm('Delete this project?')) {
      state.projects = state.projects.filter((x) => x.id !== p.id);
      selectedProjectId = null;
    }
  }
  if (action === 'pdf') downloadProjectPdf(p);
  if (action === 'whatsapp') openWhatsapp(p);
  saveState();
  renderDashboard();
  renderProjectList();
  renderProjectForm();
}

function downloadProjectPdf(p) {
  const w = window.open('', '_blank');
  w.document.write(`<h1>${p.projectName}</h1><p>Status: ${p.status}</p><p>Total Value: ${formatMoney(p.totalValue)}</p><p>Net Profit: ${formatMoney(p.netProfit)}</p><p>Remarks: ${p.generalRemarks || '-'}</p>`);
  w.document.close();
  w.print();
}

function openWhatsapp(p) {
  const msg = encodeURIComponent(document.getElementById('waMessage')?.value || `Project ${p.projectName} update.`);
  const phone = (p.mobile || '').replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

function initQr(p) {
  const details = document.querySelector('[data-qr="details"]')?.checked;
  const financial = document.querySelector('[data-qr="financial"]')?.checked;
  const pdf = document.querySelector('[data-qr="pdf"]')?.checked;
  const payload = {
    project: p.projectName,
    ...(details ? { status: p.status, deadline: p.deadline, contact: p.contactPerson } : {}),
    ...(financial ? { total: p.totalValue, pending: p.pendingAmount, net: p.netProfit } : {}),
    ...(pdf ? { pdfHint: 'Use in-app Download PDF action' } : {})
  };
  const qr = new QRious({ element: document.getElementById('qrCanvas'), value: JSON.stringify(payload), size: 180 });
  document.querySelectorAll('[data-qr]').forEach((ch) => ch.onchange = () => initQr(p));
  return qr;
}

function renderProjectCharts(p) {
  const completed = p.phases.filter((x) => x.status === 'Completed').length;
  const pending = p.phases.length - completed;
  if (projectProgressChart) projectProgressChart.destroy();
  projectProgressChart = new Chart(document.getElementById('projectProgressChart'), {
    type: 'bar',
    data: {
      labels: ['Completed Phases', 'Pending Phases', 'Billing %', 'Payment Received'],
      datasets: [{ data: [completed, pending, +p.billingCompletion || 0, (+p.paymentReceived || 0) + (+p.cashReceived || 0)] }]
    }
  });
}

function showApp() {
  byId('loginScreen').classList.remove('active');
  byId('appScreen').classList.add('active');
  byId('welcomeLine').textContent = `Logged in as ${state.session.user} (${state.session.role})`;
  renderDashboard(); renderProjectList(); renderProjectForm();
}

byId('loginBtn').onclick = () => {
  const user = byId('username').value.trim();
  const pass = byId('password').value;
  if (!USERS[user] || USERS[user].password !== pass) {
    byId('loginError').textContent = 'Invalid credentials';
    return;
  }
  state.session = { user, role: USERS[user].role };
  saveState();
  showApp();
};

byId('logoutBtn').onclick = () => {
  state.session = null; saveState(); location.reload();
};

byId('newProjectBtn').onclick = () => {
  if (state.session?.role !== 'edit') return;
  const p = defaultProject();
  state.projects.unshift(p);
  selectedProjectId = p.id;
  saveState();
  renderDashboard(); renderProjectList(); renderProjectForm();
};

byId('projectSearch').oninput = renderProjectList;

if (state.session) showApp(); else byId('loginScreen').classList.add('active');
