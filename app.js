const seed = [{
  id: crypto.randomUUID(),
  projectName: "Skyline Office Build",
  billingName: "Skyline Interiors LLP",
  status: "Active",
  totalProjectValue: 1250000,
  paymentReceived: 450000,
  cashPaymentReceived: 120000,
  pendingAmount: 680000,
  cogs: 620000,
  operationalCost: 130000,
  otherExpenses: 50000,
  grossProfit: 630000,
  ebitda: 500000,
  netProfit: 450000,
  client: { name: "Ravi Shah", address: "Ahmedabad", contact: "9876543210", gst: "24ABCDE1234F1Z9" },
  startDate: "2026-01-05",
  deadline: "2026-04-15",
  remarks: "Client requested premium finish.",
  engineer: "Nikhil Desai",
  engineerTeam: "Rutu, Milan",
  contractor: "BuildCorp",
  contractorTeam: "12 labour",
  phases: [
    { name: "Design", start: "2026-01-05", end: "2026-01-20", dueDays: 0, alert: "", status: "Completed", remarks: "Approved", measured: true, files: [], billingDone: true, amount: 200000 },
    { name: "Execution", start: "2026-01-21", end: "2026-03-15", dueDays: 2, alert: "Need extra team", status: "Running", remarks: "On track", measured: false, files: [], billingDone: false, amount: 450000 }
  ],
  payments: [{ mode: "UPI", date: "2026-01-10", amount: 200000, remarks: "Advance" }],
  expenses: [{ name: "Material", category: "COGS", date: "2026-02-01", amount: 220000, remarks: "Steel + wood" }],
  projectFiles: [],
  qrVisibility: "Summary"
}];

let projects = JSON.parse(localStorage.getItem("projects") || "null") || seed;
let currentUser = null;
let activeProject = null;
let overviewEditMode = false;
let charts = {};
const $ = (s) => document.querySelector(s);

function save() { localStorage.setItem("projects", JSON.stringify(projects)); }
function currency(n) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }
function dueDays(end) { return Math.max(0, Math.ceil((new Date() - new Date(end)) / 86400000)); }
function statusClass(s = "") { return `status-${s.toLowerCase().replace(/\s+/g, "-")}`; }
function progressPct(p) { if (!p.phases.length) return 0; return Math.round((p.phases.filter((ph) => ph.status === "Completed").length / p.phases.length) * 100); }
function phaseBillingRatio(p) { if (!p.phases.length) return 0; return Math.round((p.phases.filter((ph) => ph.billingDone).length / p.phases.length) * 100); }

$("#login-form").onsubmit = (e) => {
  e.preventDefault();
  if ($("#password").value !== "admin123") return alert("Invalid password");
  currentUser = { name: $("#username").value || "User", role: $("#role-select").value };
  $("#welcome-text").textContent = `Welcome ${currentUser.name} • ${currentUser.role === "viewer" ? "View-only" : "Editor"}`;
  $("#login-screen").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  renderDashboard();
};
$("#logout-btn").onclick = () => location.reload();

$("#add-project-btn").onclick = () => {
  if (currentUser?.role === "viewer") return alert("View-only role cannot create projects.");
  const p = {
    id: crypto.randomUUID(), projectName: "New Project", billingName: "", status: "Progress", totalProjectValue: 0, paymentReceived: 0,
    cashPaymentReceived: 0, pendingAmount: 0, cogs: 0, operationalCost: 0, otherExpenses: 0, grossProfit: 0, ebitda: 0, netProfit: 0,
    client: { name: "", address: "", contact: "", gst: "" }, startDate: new Date().toISOString().slice(0, 10), deadline: new Date().toISOString().slice(0, 10),
    remarks: "", engineer: "", engineerTeam: "", contractor: "", contractorTeam: "", phases: [], payments: [], expenses: [], projectFiles: [], qrVisibility: "Summary"
  };
  projects.unshift(p);
  save();
  renderDashboard();
  openProject(p.id);
};

function renderDashboard() {
  const statuses = ["Active", "Completed", "Running", "Progress", "On Hold"];
  const counts = Object.fromEntries(statuses.map((s) => [s, projects.filter((p) => p.status === s).length]));
  const totalValue = projects.reduce((a, p) => a + Number(p.totalProjectValue || 0), 0);
  const pending = projects.reduce((a, p) => a + Number(p.pendingAmount || 0), 0);

  const kpis = [["Total Projects", projects.length], ["Total Value", currency(totalValue)], ["Pending Amount", currency(pending)], ...statuses.map((s) => [s, counts[s]])];
  $("#kpi-grid").innerHTML = kpis.map(([k, v]) => `<article class="card kpi"><span class="muted">${k}</span><b>${v}</b></article>`).join("");

  const alerts = [];
  projects.forEach((p) => {
    if (dueDays(p.deadline) > 0 && p.status !== "Completed") alerts.push(`${p.projectName} delayed by ${dueDays(p.deadline)} day(s).`);
    p.phases.forEach((ph) => {
      if (dueDays(ph.end) > 0 && ph.status !== "Completed") alerts.push(`${p.projectName} / ${ph.name} delayed by ${dueDays(ph.end)} day(s).`);
    });
  });
  $("#delay-alerts").innerHTML = alerts.map((a) => `<div class="alert">⚠ ${a}</div>`).join("") || "<p class='muted'>No active delays.</p>";

  $("#project-rows").innerHTML = projects.map((p) => `
    <tr>
      <td>${p.projectName}</td>
      <td>${p.client.name || "-"}</td>
      <td><span class="badge ${statusClass(p.status)}">${p.status}</span></td>
      <td>${progressPct(p)}%</td>
      <td>${phaseBillingRatio(p)}%</td>
      <td>${p.deadline}</td>
      <td>
        <div class="actions">
          <button onclick="openProject('${p.id}')">Open</button>
          <button class="secondary" onclick="deleteProject('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
  renderCharts(counts);
}

function renderCharts(counts) {
  const stx = document.getElementById("statusChart");
  const ftx = document.getElementById("financialChart");
  charts.status?.destroy();
  charts.fin?.destroy();
  charts.status = new Chart(stx, { type: "doughnut", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#22c55e", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444"] }] } });

  const totals = projects.reduce((acc, p) => {
    acc.value += +p.totalProjectValue || 0;
    acc.cogs += +p.cogs || 0;
    acc.op += +p.operationalCost || 0;
    acc.ebitda += +p.ebitda || 0;
    acc.net += +p.netProfit || 0;
    return acc;
  }, { value: 0, cogs: 0, op: 0, ebitda: 0, net: 0 });

  charts.fin = new Chart(ftx, { type: "bar", data: { labels: ["Value", "COGS", "Operational", "EBITDA", "Net"], datasets: [{ data: [totals.value, totals.cogs, totals.op, totals.ebitda, totals.net], backgroundColor: "#2563eb" }] } });
}

window.deleteProject = (id) => {
  if (currentUser?.role === "viewer") return alert("View-only role cannot delete.");
  if (!confirm("Delete project?")) return;
  projects = projects.filter((p) => p.id !== id);
  save();
  renderDashboard();
};

window.openProject = (id) => {
  activeProject = projects.find((p) => p.id === id);
  if (!activeProject) return;
  overviewEditMode = false;
  $("#project-modal").classList.remove("hidden");
  $("#modal-title").textContent = activeProject.projectName;
  setActiveTab("overview");
  renderProjectTabs();
};

function setActiveTab(tab) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-body").forEach((t) => t.classList.add("hidden"));
  $("#tab-" + tab).classList.remove("hidden");
}

$("#close-modal").onclick = () => $("#project-modal").classList.add("hidden");
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.onclick = () => {
    setActiveTab(btn.dataset.tab);
    const isOverviewTab = btn.dataset.tab === "overview";
    $("#edit-overview-btn").classList.toggle("hidden", !isOverviewTab || currentUser?.role === "viewer");
  };
});

$("#edit-overview-btn").onclick = () => {
  if (currentUser?.role === "viewer") return;
  overviewEditMode = !overviewEditMode;
  $("#edit-overview-btn").textContent = overviewEditMode ? "Cancel Edit" : "Edit Overview";
  renderOverview();
};

function overviewItem(label, value) { return `<div class="overview-item"><span class="muted">${label}</span><strong>${value || "-"}</strong></div>`; }
function inputField(label, key, type = "text", val = "") { return `<label>${label}<input data-key="${key}" type="${type}" value="${val ?? ""}" /></label>`; }

function renderOverview() {
  const p = activeProject;
  $("#edit-overview-btn").classList.toggle("hidden", currentUser?.role === "viewer");
  $("#edit-overview-btn").textContent = overviewEditMode ? "Cancel Edit" : "Edit Overview";

  if (!overviewEditMode || currentUser?.role === "viewer") {
    $("#tab-overview").innerHTML = `
      <div class="overview-grid">
        <article class="overview-card">
          <h4>Project Summary</h4>
          ${overviewItem("Project Name", p.projectName)}
          ${overviewItem("Billing Name", p.billingName)}
          ${overviewItem("Status", p.status)}
          ${overviewItem("Start Date", p.startDate)}
          ${overviewItem("Deadline", p.deadline)}
        </article>
        <article class="overview-card">
          <h4>Client Details</h4>
          ${overviewItem("Client", p.client.name)}
          ${overviewItem("Address", p.client.address)}
          ${overviewItem("Contact", p.client.contact)}
          ${overviewItem("GST", p.client.gst)}
        </article>
        <article class="overview-card">
          <h4>Financial Snapshot</h4>
          ${overviewItem("Total Project Value", currency(p.totalProjectValue))}
          ${overviewItem("Payment Received", currency(p.paymentReceived))}
          ${overviewItem("Cash Payment", currency(p.cashPaymentReceived))}
          ${overviewItem("Pending", currency(p.pendingAmount))}
          ${overviewItem("Gross Profit", currency(p.grossProfit))}
          ${overviewItem("Net Profit", currency(p.netProfit))}
        </article>
        <article class="overview-card">
          <h4>Team & Allocation</h4>
          ${overviewItem("Engineer", p.engineer)}
          ${overviewItem("Engineer Team", p.engineerTeam)}
          ${overviewItem("Contractor", p.contractor)}
          ${overviewItem("Contractor Team", p.contractorTeam)}
        </article>
      </div>
      <article class="overview-card" style="margin-top:10px;">
        <h4>General Remarks</h4>
        <p>${p.remarks || "-"}</p>
      </article>
      <div class="actions">
        <button class="secondary" onclick="downloadPdf()">Download PDF Report</button>
        <button class="secondary" onclick="openWhatsApp()">WhatsApp Client/Engineer</button>
      </div>
      <label style="margin-top:8px; display:block;">Message Box <textarea id="wa-msg">Hello, quick project update for ${p.projectName}.</textarea></label>
    `;
    return;
  }

  $("#tab-overview").innerHTML = `
    <div class="form-grid">
      ${inputField("Project Name", "projectName", "text", p.projectName)}
      ${inputField("Billing Name", "billingName", "text", p.billingName)}
      ${inputField("Status", "status", "text", p.status)}
      ${inputField("Total Project Value", "totalProjectValue", "number", p.totalProjectValue)}
      ${inputField("Payment Received", "paymentReceived", "number", p.paymentReceived)}
      ${inputField("Cash Payment Received", "cashPaymentReceived", "number", p.cashPaymentReceived)}
      ${inputField("Pending Amount", "pendingAmount", "number", p.pendingAmount)}
      ${inputField("Client Name", "client.name", "text", p.client.name)}
      ${inputField("Address", "client.address", "text", p.client.address)}
      ${inputField("Contact Mobile", "client.contact", "text", p.client.contact)}
      ${inputField("GST", "client.gst", "text", p.client.gst)}
      ${inputField("Start Date", "startDate", "date", p.startDate)}
      ${inputField("Deadline", "deadline", "date", p.deadline)}
      ${inputField("Engineer Name", "engineer", "text", p.engineer)}
      ${inputField("Engineer Team", "engineerTeam", "text", p.engineerTeam)}
      ${inputField("Contractor Name", "contractor", "text", p.contractor)}
      ${inputField("Contractor Team / Labour", "contractorTeam", "text", p.contractorTeam)}
      ${inputField("COGS", "cogs", "number", p.cogs)}
      ${inputField("Gross Profit", "grossProfit", "number", p.grossProfit)}
      ${inputField("Operational Cost", "operationalCost", "number", p.operationalCost)}
      ${inputField("EBITDA", "ebitda", "number", p.ebitda)}
      ${inputField("Other Expenses", "otherExpenses", "number", p.otherExpenses)}
      ${inputField("Net Profit", "netProfit", "number", p.netProfit)}
    </div>
    <label>General Remarks <textarea id="remarks">${p.remarks || ""}</textarea></label>
    <div class="actions">
      <button onclick="saveOverview()">Save Overview</button>
      <button class="secondary" onclick="downloadPdf()">Download PDF Report</button>
      <button class="secondary" onclick="openWhatsApp()">WhatsApp Client/Engineer</button>
    </div>
    <label>Message Box <textarea id="wa-msg">Hello, quick project update for ${p.projectName}.</textarea></label>
  `;
}

function renderProjectTabs() {
  renderOverview();
  const p = activeProject;

  $("#tab-phases").innerHTML = `
    <p>Phase Management (${p.phases.length}/200)</p>
    <div class="form-grid">
      <input id="ph-name" placeholder="Phase Name" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-start" type="date" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-end" type="date" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-alert" placeholder="Alerts" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-status" placeholder="Status" value="Progress" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-remarks" placeholder="Remarks" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ph-amount" type="number" placeholder="Billing Amount" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
    </div>
    <button onclick="addPhase()" ${currentUser?.role === "viewer" ? "disabled" : ""}>Add Phase</button>
    <div>${p.phases.map((ph, i) => `<div class='card section' style='margin-top:8px;'>
      <b>${i + 1}. ${ph.name}</b> • ${ph.start} → ${ph.end} • Due Days: ${dueDays(ph.end)}
      <br>Status: <span class="badge ${statusClass(ph.status)}">${ph.status}</span> • Alerts: ${ph.alert || "-"}
      <br>Remarks: ${ph.remarks || "-"}
      <br><label><input type="checkbox" ${ph.measured ? "checked" : ""} onchange="toggleMeasured(${i})" ${currentUser?.role === "viewer" ? "disabled" : ""}/> Measurements done</label>
      <br><label>Upload PDF/Photo <input type="file" onchange="phaseFile(${i}, this.files)" ${currentUser?.role === "viewer" ? "disabled" : ""}/></label>
      <small>${(ph.files || []).join(", ")}</small>
      <br><label><input type="checkbox" ${ph.billingDone ? "checked" : ""} onchange="toggleBilling(${i})" ${currentUser?.role === "viewer" ? "disabled" : ""}/> Billing completed</label>
    </div>`).join("")}</div>
  `;

  $("#tab-payments").innerHTML = `
    <div class="form-grid">
      <input id="pay-mode" placeholder="Payment Mode" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="pay-date" type="date" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="pay-amount" type="number" placeholder="Amount" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="pay-remarks" placeholder="Remarks" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
    </div>
    <button onclick="addPayment()" ${currentUser?.role === "viewer" ? "disabled" : ""}>Add Payment Entry</button>
    <ul>${p.payments.map((py) => `<li>${py.date} • ${py.mode} • ${currency(py.amount)} • ${py.remarks || ""}</li>`).join("")}</ul>
  `;

  $("#tab-expenses").innerHTML = `
    <div class="form-grid">
      <input id="ex-name" placeholder="Expense name" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ex-category" placeholder="Category" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ex-date" type="date" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ex-amount" type="number" placeholder="Amount" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
      <input id="ex-remarks" placeholder="Remarks" ${currentUser?.role === "viewer" ? "disabled" : ""}/>
    </div>
    <button onclick="addExpense()" ${currentUser?.role === "viewer" ? "disabled" : ""}>Add Expense</button>
    <ul>${p.expenses.map((ex) => `<li>${ex.date} • ${ex.name} (${ex.category}) • ${currency(ex.amount)} • ${ex.remarks || ""}</li>`).join("")}</ul>
  `;

  const qrData = encodeURIComponent(JSON.stringify({ project: p.projectName, status: p.status, value: p.totalProjectValue, visibility: p.qrVisibility }));
  $("#tab-files").innerHTML = `
    <label>Upload GST / Other File <input type="file" onchange="projectFile(this.files)" ${currentUser?.role === "viewer" ? "disabled" : ""}/></label>
    <ul>${p.projectFiles.map((f) => `<li>${f}</li>`).join("")}</ul>
    <label>QR Visibility
      <select id="qr-visibility" ${currentUser?.role === "viewer" ? "disabled" : ""}>
        <option ${p.qrVisibility === "Summary" ? "selected" : ""}>Summary</option>
        <option ${p.qrVisibility === "Full Details" ? "selected" : ""}>Full Details</option>
        <option ${p.qrVisibility === "PDF Link" ? "selected" : ""}>PDF Link</option>
      </select>
    </label>
    <button onclick="saveQrVisibility()" ${currentUser?.role === "viewer" ? "disabled" : ""}>Save Visibility</button>
    <p>Scan QR to view shared payload:</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${qrData}" alt="qr" />
  `;
}

window.saveOverview = () => {
  if (currentUser?.role === "viewer") return;
  document.querySelectorAll("#tab-overview input[data-key]").forEach((i) => setByPath(activeProject, i.dataset.key, i.value));
  activeProject.remarks = $("#remarks").value;
  overviewEditMode = false;
  save();
  renderDashboard();
  renderOverview();
};

function setByPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const ref = keys.reduce((r, k) => r[k], obj);
  ref[last] = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
}

window.addPhase = () => {
  if (currentUser?.role === "viewer") return;
  if (activeProject.phases.length >= 200) return alert("Max 200 phases allowed.");
  const start = $("#ph-start").value;
  const end = $("#ph-end").value;
  activeProject.phases.push({
    name: $("#ph-name").value, start, end, dueDays: dueDays(end), alert: $("#ph-alert").value,
    status: $("#ph-status").value || "Progress", remarks: $("#ph-remarks").value, measured: false, files: [], billingDone: false, amount: +($("#ph-amount").value || 0)
  });
  save();
  renderDashboard();
  renderProjectTabs();
};
window.phaseFile = (idx, files) => { if (currentUser?.role === "viewer") return; activeProject.phases[idx].files.push(...Array.from(files).map((f) => f.name)); save(); renderProjectTabs(); };
window.projectFile = (files) => { if (currentUser?.role === "viewer") return; activeProject.projectFiles.push(...Array.from(files).map((f) => f.name)); save(); renderProjectTabs(); };
window.toggleMeasured = (idx) => { activeProject.phases[idx].measured = !activeProject.phases[idx].measured; save(); renderProjectTabs(); };
window.toggleBilling = (idx) => { activeProject.phases[idx].billingDone = !activeProject.phases[idx].billingDone; save(); renderDashboard(); renderProjectTabs(); };
window.addPayment = () => { if (currentUser?.role === "viewer") return; activeProject.payments.push({ mode: $("#pay-mode").value, date: $("#pay-date").value, amount: +($("#pay-amount").value || 0), remarks: $("#pay-remarks").value }); save(); renderProjectTabs(); };
window.addExpense = () => { if (currentUser?.role === "viewer") return; activeProject.expenses.push({ name: $("#ex-name").value, category: $("#ex-category").value, date: $("#ex-date").value, amount: +($("#ex-amount").value || 0), remarks: $("#ex-remarks").value }); save(); renderProjectTabs(); };
window.openWhatsApp = () => { const number = activeProject.client.contact || ""; const msg = encodeURIComponent($("#wa-msg")?.value || "Project update"); window.open(`https://wa.me/${number}?text=${msg}`, "_blank"); };
window.saveQrVisibility = () => { if (currentUser?.role === "viewer") return; activeProject.qrVisibility = $("#qr-visibility").value; save(); renderProjectTabs(); };
window.downloadPdf = () => {
  const doc = new jspdf.jsPDF();
  doc.setFontSize(14); doc.text(`Project Report: ${activeProject.projectName}`, 10, 15);
  doc.setFontSize(10);
  const rows = [
    ["Client", activeProject.client.name], ["Status", activeProject.status], ["Project Value", currency(activeProject.totalProjectValue)],
    ["Payment Received", currency(activeProject.paymentReceived)], ["Pending", currency(activeProject.pendingAmount)], ["Deadline", activeProject.deadline],
    ["Progress", `${progressPct(activeProject)}%`], ["Billing Ratio", `${phaseBillingRatio(activeProject)}%`], ["Remarks", activeProject.remarks || "-"]
  ];
  rows.forEach((r, i) => doc.text(`${r[0]}: ${r[1]}`, 10, 30 + i * 7));
  doc.save(`${activeProject.projectName.replace(/\s+/g, "_")}_report.pdf`);
};
