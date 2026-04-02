const STORAGE_KEY = "comServeData";
const SESSION_KEY = "comServeSession";
const THEME_KEY = "comServeTheme";

const money = (v) => `R${Number(v || 0).toFixed(2)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const toDate = (iso) => new Date(`${iso}T00:00:00`);
const uid = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const state = {
  data: null,
  session: null,
};

function seedData() {
  const areas = ["Section A", "Section B", "Section C", "Section D"];
  const households = [];

  for (let i = 1; i <= 20; i += 1) {
    const id = `HH${String(i).padStart(3, "0")}`;
    households.push({
      id,
      password: `pass${String(i).padStart(3, "0")}`,
      area: areas[(i - 1) % areas.length],
      active: i !== 7 && i !== 14,
      walletBalance: 10 + (i % 5) * 14,
      dues: {},
      paymentHistory: [],
    });
  }

  const data = {
    config: {
      contributionAmount: 10,
      fineAmount: 5,
      dueDays: 7,
    },
    admin: {
      username: "admin",
      password: "admin123",
    },
    households,
    funeralEvents: [],
    announcements: [
      {
        id: uid(),
        date: new Date().toISOString(),
        title: "Welcome Notice",
        body: "Welcome to COM-SERVE. Stay current to avoid fines.",
      },
    ],
    notifications: [],
    activity: [],
  };

  // Demo events and mixed payment scenarios.
  for (let n = 1; n <= 3; n += 1) {
    const eventDate = new Date(Date.now() - (18 - n * 5) * 86400000);
    const dueDate = new Date(eventDate.getTime() + data.config.dueDays * 86400000);
    const event = {
      id: `FNR${n}`,
      title: `Funeral Event ${n}`,
      date: eventDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: data.config.contributionAmount,
    };
    data.funeralEvents.push(event);

    data.households.forEach((h, idx) => {
      if (!h.active) {
        return;
      }

      const due = {
        funeralId: event.id,
        amount: event.amount,
        status: "unpaid",
        method: null,
        paidDate: null,
        fineAccrued: 0,
        lastFineAppliedOn: event.dueDate,
      };

      if ((idx + n) % 4 !== 0 && h.walletBalance >= event.amount) {
        h.walletBalance -= event.amount;
        due.status = "paid";
        due.method = "Wallet";
        due.paidDate = new Date(eventDate.getTime() + 2 * 86400000).toISOString();
        h.paymentHistory.unshift({
          id: uid(),
          date: due.paidDate,
          amount: event.amount,
          method: "Wallet",
          type: "Contribution",
          note: `Auto deduction for ${event.title}`,
          funeralId: event.id,
        });
      }

      h.dues[event.id] = due;
    });
  }

  applyFines(data);
  data.notifications.unshift({
    id: uid(),
    date: new Date().toISOString(),
    target: "all",
    message: "System initialized with demo households.",
    level: "info",
  });
  return data;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.data = seedData();
    saveData();
    return;
  }

  try {
    state.data = JSON.parse(raw);
  } catch {
    state.data = seedData();
  }

  state.data.announcements = state.data.announcements || [];
  state.data.notifications = state.data.notifications || [];
  state.data.activity = state.data.activity || [];
  applyFines(state.data);
  saveData();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    state.session = null;
    return;
  }

  try {
    state.session = JSON.parse(raw);
  } catch {
    state.session = null;
    localStorage.removeItem(SESSION_KEY);
  }
}

function saveSession() {
  if (!state.session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
}

function addNotification(target, message, level = "info") {
  state.data.notifications.unshift({
    id: uid(),
    date: new Date().toISOString(),
    target,
    message,
    level,
  });
}

function addActivity(text) {
  state.data.activity.unshift({
    id: uid(),
    date: new Date().toISOString(),
    text,
  });
  state.data.activity = state.data.activity.slice(0, 80);
}

function getHouseholdById(id) {
  return state.data.households.find((h) => h.id === id);
}

function currentHousehold() {
  if (!state.session || state.session.role !== "household") {
    return null;
  }
  return getHouseholdById(state.session.id);
}

function latestEvent() {
  if (!state.data.funeralEvents.length) {
    return null;
  }
  return state.data.funeralEvents[state.data.funeralEvents.length - 1];
}

function totals(household) {
  let outstanding = 0;
  let fines = 0;
  let overdue = 0;

  Object.values(household.dues || {}).forEach((due) => {
    if (due.status !== "unpaid") {
      return;
    }

    outstanding += Number(due.amount || 0);
    fines += Number(due.fineAccrued || 0);

    const event = state.data.funeralEvents.find((f) => f.id === due.funeralId);
    if (event && toDate(todayISO()) > toDate(event.dueDate)) {
      overdue += 1;
    }
  });

  return { outstanding, fines, total: outstanding + fines, overdue };
}

function consistency(household) {
  const totalEvents = state.data.funeralEvents.length;
  if (!totalEvents) {
    return { paid: 0, total: 0, percent: 100 };
  }

  let paid = 0;
  state.data.funeralEvents.forEach((event) => {
    const due = household.dues[event.id];
    if (due && due.status === "paid") {
      paid += 1;
    }
  });

  return { paid, total: totalEvents, percent: Math.round((paid / totalEvents) * 100) };
}

function statusLabel(household) {
  const t = totals(household);
  if (t.overdue > 0) {
    return { text: "Overdue", cls: "overdue" };
  }
  if (t.total > 0) {
    return { text: "Pending Payment", cls: "" };
  }
  return { text: "In Good Standing", cls: "good" };
}

function nextDue(household) {
  const list = Object.values(household.dues || {})
    .filter((due) => due.status === "unpaid")
    .sort((a, b) => {
      const ea = state.data.funeralEvents.find((f) => f.id === a.funeralId);
      const eb = state.data.funeralEvents.find((f) => f.id === b.funeralId);
      return toDate(ea.dueDate) - toDate(eb.dueDate);
    });

  if (!list.length) {
    return null;
  }

  const due = list[0];
  const event = state.data.funeralEvents.find((f) => f.id === due.funeralId);
  return { due, event };
}

function applyFines(data) {
  const now = toDate(todayISO());
  const fine = Number(data.config.fineAmount || 0);
  data.notifications = data.notifications || [];

  data.households.forEach((h) => {
    Object.values(h.dues || {}).forEach((due) => {
      if (due.status === "paid") {
        return;
      }

      const event = data.funeralEvents.find((f) => f.id === due.funeralId);
      if (!event) {
        return;
      }

      const dueDate = toDate(event.dueDate);
      if (now <= dueDate) {
        return;
      }

      const lastApplied = toDate(due.lastFineAppliedOn || event.dueDate);
      const days = Math.floor((now - lastApplied) / 86400000);
      if (days <= 0) {
        return;
      }

      const added = days * fine;
      due.fineAccrued = Number(due.fineAccrued || 0) + added;
      due.lastFineAppliedOn = todayISO();
      data.notifications.unshift({
        id: uid(),
        date: new Date().toISOString(),
        target: h.id,
        message: `You missed a payment. Fine added: ${money(added)}.`,
        level: "warn",
      });
    });
  });
}

function setTheme(isDark) {
  document.body.classList.toggle("dark", Boolean(isDark));
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === "dark");
}

function bindLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) {
    return;
  }

  btn.addEventListener("click", () => {
    state.session = null;
    saveSession();
    window.location.href = "index.html";
  });
}

function bindThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) {
    return;
  }

  const syncLabel = () => {
    btn.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
  };

  syncLabel();
  btn.addEventListener("click", () => {
    const enableDark = !document.body.classList.contains("dark");
    setTheme(enableDark);
    syncLabel();
    showToast(`Theme changed to ${enableDark ? "dark" : "light"}.`);
  });
}

function bindMobileNav() {
  document.querySelectorAll(".nav-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.navTarget;
      const nav = document.getElementById(targetId);
      if (!nav) {
        return;
      }

      nav.classList.toggle("open");
    });
  });

  document.querySelectorAll(".nav.nav-stack a").forEach((link) => {
    link.addEventListener("click", () => {
      const stack = link.closest(".nav.nav-stack");
      if (stack) {
        stack.classList.remove("open");
      }
    });
  });
}

function showToast(message, kind = "") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    return;
  }

  const node = document.createElement("div");
  node.className = `toast ${kind}`.trim();
  node.textContent = message;
  container.appendChild(node);

  setTimeout(() => {
    node.remove();
  }, 2800);
}

function closeModal() {
  const root = document.getElementById("modalRoot");
  if (root) {
    root.innerHTML = "";
  }
}

function confirmModal({ title, body, confirmText = "Confirm", onConfirm }) {
  const root = document.getElementById("modalRoot");
  if (!root) {
    onConfirm();
    return;
  }

  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${title}</h3>
        <p class="muted">${body}</p>
        <div class="inline-row wrap" style="margin-top: 0.8rem;">
          <button id="modalConfirmBtn" class="btn btn-primary" type="button">${confirmText}</button>
          <button id="modalCancelBtn" class="btn btn-ghost" type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("modalCancelBtn").onclick = closeModal;
  document.getElementById("modalConfirmBtn").onclick = () => {
    closeModal();
    onConfirm();
  };
}

function markNavActive() {
  const page = window.location.pathname.split("/").pop();
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.getAttribute("href") === page) {
      a.classList.add("active");
    }
  });
}

function requireAuth(role) {
  if (!state.session) {
    window.location.href = "index.html";
    return false;
  }

  if (role && state.session.role !== role) {
    window.location.href = state.session.role === "admin" ? "admin.html" : "household.html";
    return false;
  }

  return true;
}

function payDue(household, funeralId, method) {
  const due = household.dues[funeralId];
  if (!due || due.status === "paid") {
    return { ok: false, message: "Due already paid or unavailable." };
  }

  const amount = Number(due.amount || 0) + Number(due.fineAccrued || 0);
  if (method === "Wallet" && household.walletBalance < amount) {
    return { ok: false, message: "Insufficient wallet balance." };
  }

  if (method === "Wallet") {
    household.walletBalance -= amount;
  }

  due.status = "paid";
  due.method = method;
  due.paidDate = new Date().toISOString();

  household.paymentHistory.unshift({
    id: uid(),
    date: due.paidDate,
    amount,
    method,
    type: "Contribution",
    note: `Payment for ${funeralId}`,
    funeralId,
  });

  addNotification(household.id, "Payment successful.", "info");
  addActivity(`${household.id} paid ${funeralId} via ${method}.`);
  saveData();
  return { ok: true, message: `Payment successful via ${method}.` };
}

function topupHousehold(household, amount) {
  household.walletBalance += amount;
  household.paymentHistory.unshift({
    id: uid(),
    date: new Date().toISOString(),
    amount,
    method: "Manual",
    type: "Wallet Top Up",
    note: "Household wallet top-up",
  });
  addNotification(household.id, `Wallet credited with ${money(amount)}.`, "info");
  saveData();
}

function triggerFuneralEvent(title, dueDays) {
  const event = {
    id: `FNR${Date.now()}`,
    title,
    date: todayISO(),
    dueDate: new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10),
    amount: Number(state.data.config.contributionAmount || 10),
  };

  state.data.funeralEvents.push(event);

  state.data.households.forEach((h) => {
    if (!h.active) {
      return;
    }

    const due = {
      funeralId: event.id,
      amount: event.amount,
      status: "unpaid",
      method: null,
      paidDate: null,
      fineAccrued: 0,
      lastFineAppliedOn: event.dueDate,
    };

    if (h.walletBalance >= event.amount) {
      h.walletBalance -= event.amount;
      due.status = "paid";
      due.method = "Wallet";
      due.paidDate = new Date().toISOString();
      h.paymentHistory.unshift({
        id: uid(),
        date: due.paidDate,
        amount: event.amount,
        method: "Wallet",
        type: "Contribution",
        note: `Auto deduction for ${title}`,
        funeralId: event.id,
      });
    }

    h.dues[event.id] = due;
  });

  addNotification("all", `New funeral contribution required: ${money(event.amount)}.`, "info");
  addActivity(`Admin triggered event: ${title}.`);
  saveData();
}

function postAnnouncement(title, body) {
  state.data.announcements.unshift({
    id: uid(),
    date: new Date().toISOString(),
    title,
    body,
  });
  addNotification("all", `Announcement: ${title}`, "info");
  addActivity(`Admin posted announcement: ${title}.`);
  saveData();
}

function exportAdminCsv() {
  const rows = [["HouseholdID", "Area", "Wallet", "Outstanding", "Fines", "Status"]];
  const latest = latestEvent();

  state.data.households.forEach((h) => {
    const t = totals(h);
    const latestStatus = latest && h.dues[latest.id] ? h.dues[latest.id].status : "n/a";
    rows.push([h.id, h.area, h.walletBalance.toFixed(2), t.outstanding.toFixed(2), t.fines.toFixed(2), latestStatus]);
  });

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `com-serve-admin-report-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV report exported.");
}

function drawStatusChart(paid, unpaid) {
  const canvas = document.getElementById("chartStatus");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const max = Math.max(1, paid, unpaid);
  const pad = 35;
  const barW = 110;

  ctx.fillStyle = "#555";
  ctx.font = "13px IBM Plex Sans";
  ctx.fillText("Paid vs Unpaid", 12, 18);

  const paidH = ((h - pad * 2) * paid) / max;
  const unpaidH = ((h - pad * 2) * unpaid) / max;

  ctx.fillStyle = "#1f8f4a";
  ctx.fillRect(70, h - pad - paidH, barW, paidH);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(240, h - pad - unpaidH, barW, unpaidH);

  ctx.fillStyle = "#555";
  ctx.fillText(`Paid: ${paid}`, 78, h - 10);
  ctx.fillText(`Unpaid: ${unpaid}`, 244, h - 10);
}

function drawFundsChart(series, chartId = "chartFunds", color = "#0d7a5f", label = "Collections over recent events") {
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!series.length) {
    return;
  }

  const max = Math.max(1, ...series.map((s) => s.value));
  const pad = 30;

  ctx.strokeStyle = "#8ca39a";
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  series.forEach((point, i) => {
    const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
    const y = h - pad - (point.value / max) * (h - pad * 2);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
  ctx.fillStyle = "#555";
  ctx.font = "13px IBM Plex Sans";
  ctx.fillText(label, 12, 18);
}

function initLoginPage() {
  if (state.session) {
    window.location.href = state.session.role === "admin" ? "admin.html" : "household.html";
    return;
  }

  const message = document.getElementById("loginMessage");

  document.getElementById("householdLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("householdId").value.trim().toUpperCase();
    const password = document.getElementById("householdPassword").value;

    const h = getHouseholdById(id);
    if (!h || h.password !== password) {
      message.textContent = "Invalid household credentials.";
      return;
    }

    state.session = { role: "household", id };
    saveSession();
    window.location.href = "household.html";
  });

  document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (username !== state.data.admin.username || password !== state.data.admin.password) {
      message.textContent = "Invalid admin credentials.";
      return;
    }

    state.session = { role: "admin", id: "ADMIN" };
    saveSession();
    window.location.href = "admin.html";
  });

  document.getElementById("forgotPasswordLink").addEventListener("click", (e) => {
    e.preventDefault();
    message.textContent = "Password reset link sent (simulation). Contact admin for immediate help.";
    message.classList.add("ok");
  });
}

function renderHouseholdDashboard() {
  const h = currentHousehold();
  if (!h) {
    return;
  }

  const t = totals(h);
  const c = consistency(h);
  const status = statusLabel(h);
  const dueInfo = nextDue(h);

  document.getElementById("walletBalance").textContent = money(h.walletBalance);
  document.getElementById("finesOwed").textContent = money(t.fines);
  document.getElementById("consistencyText").textContent = `${c.paid} of ${c.total} events paid (${c.percent}%)`;

  const statusEl = document.getElementById("paymentStatus");
  statusEl.textContent = status.text;
  statusEl.className = `status-pill ${status.cls}`;

  if (!dueInfo) {
    document.getElementById("upcomingDueTitle").textContent = "No pending dues";
    document.getElementById("upcomingDueDate").textContent = "-";
    document.getElementById("upcomingDueAmount").textContent = money(0);
  } else {
    const totalDue = Number(dueInfo.due.amount || 0) + Number(dueInfo.due.fineAccrued || 0);
    document.getElementById("upcomingDueTitle").textContent = dueInfo.event.title;
    document.getElementById("upcomingDueDate").textContent = `Due: ${dueInfo.event.dueDate}`;
    document.getElementById("upcomingDueAmount").textContent = money(totalDue);
  }

  document.getElementById("householdBanner").textContent =
    t.overdue > 0
      ? `You have ${t.overdue} overdue contribution(s). Pay immediately to stop additional fines.`
      : t.total > 0
        ? "You have pending contributions due soon."
        : "Your account is in good standing.";

  document.getElementById("topupBtn").onclick = () => {
    const amount = Number(document.getElementById("topupAmount").value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid top-up amount.", "error");
      return;
    }
    confirmModal({
      title: "Confirm Top-Up",
      body: `Top up wallet by ${money(amount)}?`,
      confirmText: "Top Up",
      onConfirm: () => {
        topupHousehold(h, amount);
        document.getElementById("topupAmount").value = "";
        renderHouseholdDashboard();
        showToast(`Wallet topped up by ${money(amount)}.`);
      },
    });
  };

  document.getElementById("payNowBtn").onclick = () => {
    const next = nextDue(h);
    if (!next) {
      showToast("No unpaid dues found.");
      return;
    }

    const totalDue = Number(next.due.amount || 0) + Number(next.due.fineAccrued || 0);
    confirmModal({
      title: "Confirm Payment",
      body: `Pay ${money(totalDue)} for ${next.event.title} via Wallet?`,
      confirmText: "Pay Now",
      onConfirm: () => {
        const result = payDue(h, next.due.funeralId, "Wallet");
        if (!result.ok) {
          document.getElementById("householdBanner").textContent = result.message;
          showToast(result.message, "error");
        } else {
          showToast(result.message);
        }
        renderHouseholdDashboard();
      },
    });
  };

  const stickyPayBtn = document.getElementById("stickyPayBtn");
  if (stickyPayBtn) {
    stickyPayBtn.onclick = document.getElementById("payNowBtn").onclick;
  }

  const alerts = state.data.notifications
    .filter((n) => n.target === "all" || n.target === h.id)
    .slice(0, 10);
  const alertBox = document.getElementById("householdAlerts");
  alertBox.innerHTML = alerts.length
    ? alerts
        .map((a) => `<div class="list-item ${a.level === "warn" ? "warn" : ""}">${new Date(a.date).toLocaleString()} - ${a.message}</div>`)
        .join("")
    : '<div class="list-item">No alerts.</div>';

  const history = [...(h.paymentHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const body = document.getElementById("householdHistoryBody");
  body.innerHTML = history.length
    ? history
        .slice(0, 20)
        .map(
          (p) => `
      <tr>
        <td>${new Date(p.date).toLocaleString()}</td>
        <td>${money(p.amount)}</td>
        <td>${p.method}</td>
        <td>${p.type}</td>
        <td>${p.note || "-"}</td>
      </tr>`
        )
        .join("")
    : '<tr><td colspan="5">No payment history.</td></tr>';

  drawHouseholdProgressChart(h);
}

function drawHouseholdProgressChart(household) {
  const canvas = document.getElementById("householdProgressChart");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const events = state.data.funeralEvents.slice(-8);
  const values = events.map((event) => {
    const due = household.dues[event.id];
    return due && due.status === "paid" ? 1 : 0;
  });

  const pad = 34;
  const barW = Math.max(16, (w - pad * 2) / Math.max(values.length, 1) - 14);

  ctx.fillStyle = "#5f6b62";
  ctx.font = "13px IBM Plex Sans";
  ctx.fillText("Recent contribution completion", 12, 18);

  values.forEach((v, i) => {
    const x = pad + i * (barW + 14);
    const barH = v ? h - pad * 2 : (h - pad * 2) * 0.26;
    const y = h - pad - barH;
    ctx.fillStyle = v ? "#1f8f4a" : "#c0392b";
    ctx.fillRect(x, y, barW, barH);
  });
}

function initHouseholdDashboardPage() {
  if (!requireAuth("household")) {
    return;
  }
  renderHouseholdDashboard();
}

function renderPaymentsPage() {
  const h = currentHousehold();
  if (!h) {
    return;
  }

  const dues = Object.values(h.dues || {}).filter((d) => d.status === "unpaid");
  const select = document.getElementById("paymentDueSelect");
  select.innerHTML = dues.length
    ? dues
        .map((due) => {
          const event = state.data.funeralEvents.find((f) => f.id === due.funeralId);
          const totalDue = Number(due.amount || 0) + Number(due.fineAccrued || 0);
          return `<option value="${due.funeralId}">${event ? event.title : due.funeralId} - ${money(totalDue)}</option>`;
        })
        .join("")
    : '<option value="">No unpaid dues</option>';

  const updateSummary = () => {
    const id = select.value;
    const due = h.dues[id];
    const totalDue = due ? Number(due.amount || 0) + Number(due.fineAccrued || 0) : 0;
    document.getElementById("selectedDueAmount").textContent = money(totalDue);
    document.getElementById("walletAvailable").textContent = money(h.walletBalance);
    document.getElementById("selectedDueStatus").textContent = due ? due.status : "n/a";
  };

  select.onchange = updateSummary;
  updateSummary();

  const result = document.getElementById("paymentResult");

  const handlePay = (method) => {
    if (!select.value) {
      result.textContent = "No due selected.";
      result.className = "message";
      showToast("No due selected.", "error");
      return;
    }

    const selected = h.dues[select.value];
    const totalDue = Number(selected.amount || 0) + Number(selected.fineAccrued || 0);
    confirmModal({
      title: "Confirm Payment",
      body: `Pay ${money(totalDue)} using ${method}?`,
      confirmText: "Confirm",
      onConfirm: () => {
        const response = payDue(h, select.value, method);
        result.textContent = response.message;
        result.className = `message ${response.ok ? "ok" : ""}`;
        showToast(response.message, response.ok ? "" : "error");
        renderPaymentsPage();
      },
    });
  };

  document.getElementById("payWalletBtn").onclick = () => handlePay("Wallet");
  document.getElementById("payQrBtn").onclick = () => handlePay("QR");
  document.getElementById("payCardBtn").onclick = () => handlePay("Card");

  const recentBody = document.getElementById("recentPaymentBody");
  const recent = [...(h.paymentHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
  recentBody.innerHTML = recent.length
    ? recent
        .map(
          (p) => `
      <tr>
        <td>${new Date(p.date).toLocaleString()}</td>
        <td>${money(p.amount)}</td>
        <td>${p.method}</td>
        <td>${p.type}</td>
        <td>${p.note || "-"}</td>
      </tr>`
        )
        .join("")
    : '<tr><td colspan="5">No payment history.</td></tr>';
}

function initPaymentsPage() {
  if (!requireAuth("household")) {
    return;
  }
  renderPaymentsPage();
}

function initAnnouncementsPage() {
  if (!requireAuth("household")) {
    return;
  }

  const h = currentHousehold();
  const list = document.getElementById("announcementsList");
  list.innerHTML = state.data.announcements.length
    ? state.data.announcements
        .map((a) => `<div class="list-item"><strong>${a.title}</strong><br>${a.body}<br><small>${new Date(a.date).toLocaleString()}</small></div>`)
        .join("")
    : '<div class="list-item">No announcements available.</div>';

  const notices = state.data.notifications
    .filter((n) => n.target === "all" || n.target === h.id)
    .slice(0, 12);
  const noticeList = document.getElementById("noticesList");
  noticeList.innerHTML = notices.length
    ? notices
        .map((n) => `<div class="list-item ${n.level === "warn" ? "warn" : ""}">${new Date(n.date).toLocaleString()} - ${n.message}</div>`)
        .join("")
    : '<div class="list-item">No notifications.</div>';
}

function initSettingsPage() {
  if (!requireAuth("household")) {
    return;
  }

  const h = currentHousehold();
  document.getElementById("profileId").textContent = h.id;
  document.getElementById("profileArea").textContent = h.area;

  const toggle = document.getElementById("settingsDarkToggle");
  toggle.checked = document.body.classList.contains("dark");
  toggle.onchange = () => {
    setTheme(toggle.checked);
    showToast(`Theme switched to ${toggle.checked ? "dark" : "light"}.`);
  };

  const msg = document.getElementById("settingsMessage");
  document.getElementById("changePasswordForm").onsubmit = (e) => {
    e.preventDefault();
    const current = document.getElementById("currentPassword").value;
    const next = document.getElementById("newPassword").value;

    if (current !== h.password) {
      msg.textContent = "Current password is incorrect.";
      msg.className = "message";
      return;
    }

    if (!next || next.length < 4) {
      msg.textContent = "New password must be at least 4 characters.";
      msg.className = "message";
      return;
    }

    h.password = next;
    saveData();
    msg.textContent = "Password updated successfully.";
    msg.className = "message ok";
    showToast("Password updated successfully.");

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
  };
}

function renderAdminPage() {
  const households = state.data.households;
  const latest = latestEvent();

  let paid = 0;
  let unpaid = 0;
  let collected = 0;
  let fines = 0;

  households.forEach((h) => {
    const t = totals(h);
    fines += t.fines;

    h.paymentHistory.forEach((p) => {
      if (p.type === "Contribution") {
        collected += Number(p.amount || 0);
      }
    });

    if (latest && h.active) {
      const due = h.dues[latest.id];
      if (due && due.status === "paid") {
        paid += 1;
      } else {
        unpaid += 1;
      }
    }
  });

  document.getElementById("adminMetricHouseholds").textContent = String(households.length);
  document.getElementById("adminMetricPaidUnpaid").textContent = `${paid} / ${unpaid}`;
  document.getElementById("adminMetricCollected").textContent = money(collected);
  document.getElementById("adminMetricFines").textContent = money(fines);

  drawStatusChart(paid, unpaid);

  const series = state.data.funeralEvents.slice(-8).map((event) => {
    let sum = 0;
    households.forEach((h) => {
      const due = h.dues[event.id];
      if (due && due.status === "paid") {
        sum += Number(due.amount || 0) + Number(due.fineAccrued || 0);
      }
    });
    return { label: event.title, value: sum };
  });
  drawFundsChart(series);

  const fineSeries = state.data.funeralEvents.slice(-8).map((event) => {
    let amount = 0;
    households.forEach((household) => {
      const due = household.dues[event.id];
      if (due && due.status === "unpaid") {
        amount += Number(due.fineAccrued || 0);
      }
    });
    return { label: event.title, value: amount };
  });
  drawFundsChart(fineSeries, "chartFines", "#d97706", "Fines trend");

  const query = document.getElementById("adminSearch").value.trim().toUpperCase();
  const filtered = households.filter((h) => !query || h.id.includes(query));

  const body = document.getElementById("adminHouseholdBody");
  body.innerHTML = filtered.length
    ? filtered
        .map((h) => {
          const t = totals(h);
          const latestStatus = latest && h.dues[latest.id] ? h.dues[latest.id].status : "n/a";
          return `
      <tr>
        <td>${h.id}</td>
        <td>${h.area}</td>
        <td>${money(h.walletBalance)}</td>
        <td>${money(t.outstanding)}</td>
        <td>${money(t.fines)}</td>
        <td><span class="tag ${latestStatus === "paid" ? "good" : "bad"}">${latestStatus}</span></td>
        <td><button class="btn btn-ghost clear-fines-btn" data-id="${h.id}" type="button">Clear Fines</button></td>
      </tr>`;
        })
        .join("")
    : '<tr><td colspan="7">No households found.</td></tr>';

  body.querySelectorAll(".clear-fines-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const h = getHouseholdById(id);
      if (!h) {
        return;
      }

      Object.values(h.dues || {}).forEach((due) => {
        if (due.status === "unpaid") {
          due.fineAccrued = 0;
          due.lastFineAppliedOn = todayISO();
        }
      });

      addNotification(id, "Admin cleared your outstanding fines.", "info");
      addActivity(`Admin cleared fines for ${id}.`);
      saveData();
      renderAdminPage();
      showToast(`Fines cleared for ${id}.`);
    });
  });

  const activity = document.getElementById("adminActivity");
  activity.innerHTML = state.data.activity.length
    ? state.data.activity.slice(0, 12).map((a) => `<div class="list-item">${new Date(a.date).toLocaleString()} - ${a.text}</div>`).join("")
    : '<div class="list-item">No activity yet.</div>';
}

function initAdminPage() {
  if (!requireAuth("admin")) {
    return;
  }

  document.getElementById("triggerFuneralBtn").onclick = () => {
    const title = document.getElementById("funeralTitle").value.trim() || `Funeral Event ${state.data.funeralEvents.length + 1}`;
    const dueDays = Math.max(1, Number(document.getElementById("funeralDueDays").value) || 7);
    confirmModal({
      title: "Trigger Funeral Event",
      body: `Create ${title} and charge all active households ${money(state.data.config.contributionAmount)}?`,
      confirmText: "Trigger",
      onConfirm: () => {
        triggerFuneralEvent(title, dueDays);
        document.getElementById("funeralTitle").value = "";
        renderAdminPage();
        showToast("Funeral event triggered successfully.");
      },
    });
  };

  document.getElementById("postAnnouncementBtn").onclick = () => {
    const title = document.getElementById("adminAnnouncementTitle").value.trim();
    const body = document.getElementById("adminAnnouncementBody").value.trim();
    if (!title || !body) {
      return;
    }
    postAnnouncement(title, body);
    document.getElementById("adminAnnouncementTitle").value = "";
    document.getElementById("adminAnnouncementBody").value = "";
    renderAdminPage();
    showToast("Announcement posted.");
  };

  document.getElementById("adminExportCsv").onclick = exportAdminCsv;
  document.getElementById("adminSearch").oninput = renderAdminPage;

  renderAdminPage();
}

function initPage() {
  loadData();
  loadSession();
  initTheme();
  bindLogout();
  bindThemeToggle();
  bindMobileNav();
  markNavActive();

  const page = document.body.dataset.page;

  if (page === "login") {
    initLoginPage();
    return;
  }

  if (page === "household-dashboard") {
    initHouseholdDashboardPage();
    return;
  }

  if (page === "payments") {
    initPaymentsPage();
    return;
  }

  if (page === "announcements") {
    initAnnouncementsPage();
    return;
  }

  if (page === "settings") {
    initSettingsPage();
    return;
  }

  if (page === "admin-dashboard") {
    initAdminPage();
  }
}

document.addEventListener("DOMContentLoaded", initPage);
