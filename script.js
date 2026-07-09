const API_BASE = "https://gowind-smm-panel-v3.onrender.com/api";

// Local Storage Session State Engines
let currentUser = JSON.parse(localStorage.getItem("gowind_user")) || null;
let currentAdmin = localStorage.getItem("gowind_admin_authenticated") === "true";

// Memory Storage Cache Context Arrays
let systemCacheServices = [];
let adminCacheUsers = [];
let adminCacheServices = [];
let adminCacheProviders = [];

document.addEventListener("DOMContentLoaded", () => {
  detectViewRoutingArchitectureContext();
  bindGlobalEventsEventInterceptors();
});

function detectViewRoutingArchitectureContext() {
  const isIndexPage = document.getElementById("login-form") !== null;
  const isAdminPage = document.getElementById("admin-login-form") !== null;

  if (isIndexPage) {
    if (currentUser) {
      displayApplicationWorkspaceView();
    } else {
      displayAuthenticationView();
    }
  } else if (isAdminPage) {
    if (currentAdmin) {
      displayAdminApplicationWorkspace();
    } else {
      displayAdminAuthenticationView();
    }
  }
}

function bindGlobalEventsEventInterceptors() {
  // Client Auth Processing Elements
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("login-username").value.trim();
      const p = document.getElementById("login-password").value;
      const b = document.getElementById("btn-login");
      setLoadingButtonState(b, true, "Validating Session Authenticity...");
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Authentication Protocol Rejected");
        currentUser = data.user;
        localStorage.setItem("gowind_user", JSON.stringify(currentUser));
        displayApplicationWorkspaceView();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Login");
      }
    });
  }

  const btnGotoAdmin = document.getElementById("btn-goto-admin");
  if (btnGotoAdmin) {
    btnGotoAdmin.addEventListener("click", () => { window.location.href = "admin.html"; });
  }

  const btnGotoClient = document.getElementById("btn-goto-client");
  if (btnGotoClient) {
    btnGotoClient.addEventListener("click", () => { window.location.href = "index.html"; });
  }

  // Admin Verification Process Elements
  const adminLoginForm = document.getElementById("admin-login-form");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const p = document.getElementById("admin-password").value;
      const b = document.getElementById("btn-admin-login");
      setLoadingButtonState(b, true, "Authorizing Root Identity Access Key...");
      try {
        const res = await fetch(`${API_BASE}/auth/admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: p })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Master Key Assertion Denied");
        currentAdmin = true;
        localStorage.setItem("gowind_admin_authenticated", "true");
        displayAdminApplicationWorkspace();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Authenticate Session");
      }
    });
  }

  // General Interface Panel View Router Links Triggers Setup
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.addEventListener("click", (e) => {
      const parentSidebar = e.target.closest(".sidebar");
      const targetId = e.target.getAttribute("data-target");
      
      parentSidebar.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
      e.target.classList.add("active");

      document.querySelectorAll(".panel-view").forEach(view => view.classList.add("d-none"));
      document.getElementById(targetId).classList.remove("d-none");

      triggerTargetViewRefreshExecutionLogic(targetId);
    });
  });

  // Client Operation Actions Forms Registrations
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("gowind_user");
      currentUser = null;
      window.location.reload();
    });
  }

  const btnAdminLogout = document.getElementById("btn-admin-logout");
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener("click", () => {
      localStorage.removeItem("gowind_admin_authenticated");
      currentAdmin = false;
      window.location.reload();
    });
  }

  const orderServiceSelect = document.getElementById("order-service-select");
  if (orderServiceSelect) {
    orderServiceSelect.addEventListener("change", (e) => {
      const selectedId = parseInt(e.target.value);
      const service = systemCacheServices.find(s => s.id === selectedId);
      if (service) {
        document.getElementById("order-provider-readonly").value = service.provider_name;
        document.getElementById("order-price-readonly").value = formatMoneySystemValue(service.price);
        document.getElementById("order-min-readonly").value = service.min_quantity;
        document.getElementById("order-max-readonly").value = service.max_quantity;
        calculateDynamicOrderPricingMatrixTotal();
      }
    });
  }

  const orderQuantity = document.getElementById("order-quantity");
  if (orderQuantity) {
    orderQuantity.addEventListener("input", calculateDynamicOrderPricingMatrixTotal);
  }

  const orderForm = document.getElementById("order-form");
  if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const serviceId = document.getElementById("order-service-select").value;
      const targetLink = document.getElementById("order-link").value.trim();
      const quantityVal = parseInt(document.getElementById("order-quantity").value);
      const submitBtn = document.getElementById("btn-submit-order");

      if (!serviceId) return alert("Select an active catalog deployment cluster mapping entry first.");

      setLoadingButtonState(submitBtn, true, "Dispatched Payload Authorization Handshaking...");
      try {
        const res = await fetch(`${API_BASE}/orders/new`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id, serviceId: parseInt(serviceId), link: targetLink, quantity: quantityVal })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Order Submission Critical Error Fault");
        
        alert("Transaction successful! Order dispatched.");
        await executeUpdateClientSessionProfileSyncMetrics();
        orderForm.reset();
        document.getElementById("order-total-price").value = "$0.00";
        
        // Force Navigation view router redirect to historical auditing components
        document.querySelector("[data-target='section-history']").click();
      } catch (err) {
        alert(err.message);
      } {
        setLoadingButtonState(submitBtn, false, "Authorize and Dispatch Order");
      }
    });
  }

  // Master Settings Commit Update Configuration Action Handlers
  const adminSettingsForm = document.getElementById("admin-settings-form");
  if (adminSettingsForm) {
    adminSettingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const curPass = document.getElementById("set-current-pass").value;
      const newAdminPass = document.getElementById("set-new-admin-pass").value;
      const b = document.getElementById("btn-save-settings");

      setLoadingButtonState(b, true, "Persisting Global Security Core Mapping Updates...");
      try {
        const res = await fetch(`${API_BASE}/admin/settings/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: curPass, newAdminPassword: newAdminPass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to commit security modifications.");
        alert("Global platform infrastructure configurations asserted securely.");
        adminSettingsForm.reset();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Commit Security Operations Configuration Change");
      }
    });
  }

  // Intercept Admin Modal Dialog Dynamic Form Submissions Assemblies
  const userModalForm = document.getElementById("user-modal-form");
  if (userModalForm) {
    userModalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("user-modal-id").value;
      const payload = {
        username: document.getElementById("user-modal-username").value.trim(),
        password: document.getElementById("user-modal-password").value,
        balance: parseFloat(document.getElementById("user-modal-balance").value)
      };
      const b = document.getElementById("user-modal-submit-btn");
      setLoadingButtonState(b, true, "Saving user account context data...");
      
      const endpoint = id ? `${API_BASE}/admin/users` : `${API_BASE}/admin/users`;
      const methodType = id ? "PUT" : "POST";
      if (id) payload.id = parseInt(id);

      try {
        const res = await fetch(endpoint, {
          method: methodType,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "CRUD User operation dropped"); }
        closeModal("user-modal");
        loadAdminUsersManagementContextMatrix();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Commit Transaction Records");
      }
    });
  }

  const serviceModalForm = document.getElementById("service-modal-form");
  if (serviceModalForm) {
    serviceModalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("service-modal-id").value;
      const payload = {
        api_provider_id: parseInt(document.getElementById("service-modal-provider").value),
        remote_service_id: parseInt(document.getElementById("service-modal-remoteid").value),
        name: document.getElementById("service-modal-name").value.trim(),
        price: parseFloat(document.getElementById("service-modal-price").value),
        min_quantity: parseInt(document.getElementById("service-modal-min").value),
        max_quantity: parseInt(document.getElementById("service-modal-max").value),
        enabled: document.getElementById("service-modal-enabled").value === "true"
      };
      const b = document.getElementById("service-modal-submit-btn");
      setLoadingButtonState(b, true, "Processing Service Schema Entry...");

      const methodType = id ? "PUT" : "POST";
      if (id) payload.id = parseInt(id);

      try {
        const res = await fetch(`${API_BASE}/admin/services`, {
          method: methodType,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "CRUD Catalog action error"); }
        closeModal("service-modal");
        loadAdminServiceOfferingsContextArchitecture();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Save Node Entry Mapping");
      }
    });
  }

  const providerModalForm = document.getElementById("provider-modal-form");
  if (providerModalForm) {
    providerModalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("provider-modal-id").value;
      const payload = {
        name: document.getElementById("provider-modal-name").value.trim(),
        api_url: document.getElementById("provider-modal-url").value.trim(),
        api_key: document.getElementById("provider-modal-key").value.trim(),
        enabled: document.getElementById("provider-modal-enabled").value === "true"
      };
      const b = document.getElementById("provider-modal-submit-btn");
      setLoadingButtonState(b, true, "Validating and Writing Gateway Parameters...");

      const methodType = id ? "PUT" : "POST";
      if (id) payload.id = parseInt(id);

      try {
        const res = await fetch(`${API_BASE}/admin/providers`, {
          method: methodType,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "CRUD Engine action anomaly"); }
        closeModal("provider-modal");
        loadAdminProvidersUpstreamGatewayContextTopology();
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingButtonState(b, false, "Authorize Upstream Configuration Mapping");
      }
    });
  }

  // Register Contextual Inline Live Matrix Search Filtering Key Event List hooks
  const searchUsersInput = document.getElementById("search-users-input");
  if (searchUsersInput) { searchUsersInput.addEventListener("input", renderFilteredAdminUsersList); }

  const searchServicesInput = document.getElementById("search-services-input");
  if (searchServicesInput) { searchServicesInput.addEventListener("input", renderFilteredAdminServicesList); }

  const searchProvidersInput = document.getElementById("search-providers-input");
  if (searchProvidersInput) { searchProvidersInput.addEventListener("input", renderFilteredAdminProvidersList); }
}

// Client Side Interface Logic View Orchestrators
function displayAuthenticationView() {
  document.getElementById("auth-view").classList.remove("d-none");
  document.getElementById("app-view").classList.add("d-none");
}

async function displayApplicationWorkspaceView() {
  document.getElementById("auth-view").classList.add("d-none");
  document.getElementById("app-view").classList.remove("d-none");
  await executeUpdateClientSessionProfileSyncMetrics();
  triggerTargetViewRefreshExecutionLogic("section-dashboard");
}

async function executeUpdateClientSessionProfileSyncMetrics() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/user/${currentUser.id}`);
    if (!res.ok) throw new Error("Could not pull fresh tracking snapshot matrix metrics");
    const data = await res.json();
    currentUser = data.user;
    localStorage.setItem("gowind_user", JSON.stringify(currentUser));
    
    document.getElementById("display-username").innerText = currentUser.username;
    document.getElementById("display-balance").innerText = formatMoneySystemValue(currentUser.balance);
    document.getElementById("dash-balance").innerText = formatMoneySystemValue(currentUser.balance);
  } catch (err) {
    console.error("Profile metrics refresh fault:", err);
  }
}

// Master System Dynamic Section View Router Hub Switchboard Dispatches
function triggerTargetViewRefreshExecutionLogic(sectionId) {
  switch (sectionId) {
    case "section-dashboard":
      loadClientDashboardSummariesData();
      break;
    case "section-new-order":
      populateClientActiveOffersSelectionDropdown();
      break;
    case "section-history":
      loadClientHistoricalOrderLedgerLogs();
      break;
    case "admin-section-dash":
      loadAdminMetricsDashboardAggregates();
      break;
    case "admin-section-users":
      loadAdminUsersManagementContextMatrix();
      break;
    case "admin-section-services":
      loadAdminServiceOfferingsContextArchitecture();
      break;
    case "admin-section-providers":
      loadAdminProvidersUpstreamGatewayContextTopology();
      break;
    case "admin-section-settings":
      queryRealTimeSystemConnectionStatusDiagnostics();
      break;
  }
}

// Client Core Features Framework Functions
async function loadClientDashboardSummariesData() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/orders/user/${currentUser.id}`);
    const data = await res.json();
    if (res.ok) {
      document.getElementById("dash-total-orders").innerText = data.orders.length;
    }
  } catch (e) { console.error(e); }
}

async function populateClientActiveOffersSelectionDropdown() {
  const dropdown = document.getElementById("order-service-select");
  if (!dropdown) return;
  dropdown.innerHTML = `<option value="">-- Choose a verifiable operational SMM service strategy profile --</option>`;
  try {
    const res = await fetch(`${API_BASE}/services/active`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    systemCacheServices = data.services;
    systemCacheServices.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.innerText = `[ID: ${s.id}] - ${s.name} (${formatMoneySystemValue(s.price)}/1k)`;
      dropdown.appendChild(opt);
    });
  } catch (err) { alert("Failed to build global active catalog dropdown context profiles: " + err.message); }
}

function calculateDynamicOrderPricingMatrixTotal() {
  const serviceId = document.getElementById("order-service-select").value;
  const quantityInput = document.getElementById("order-quantity").value;
  const targetOutput = document.getElementById("order-total-price");
  if (!serviceId || !quantityInput) { targetOutput.value = "$0.00"; return; }

  const service = systemCacheServices.find(s => s.id === parseInt(serviceId));
  if (service) {
    const qty = parseInt(quantityInput) || 0;
    const computedTotal = (qty / 1000) * service.price;
    targetOutput.value = formatMoneySystemValue(computedTotal);
  }
}

async function loadClientHistoricalOrderLedgerLogs() {
  if (!currentUser) return;
  const tbody = document.getElementById("user-history-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Auditing global platform network execution matrices logs...</td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/orders/user/${currentUser.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    tbody.innerHTML = "";
    if (data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No records found.</td></tr>`;
      return;
    }
    data.orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${o.id}</strong></td>
        <td><span style="font-family: monospace; color: var(--text-muted);">${o.provider_order_id || "N/A (Local Unit)"}</span></td>
        <td>${formatSystemDateTimeTimestamp(o.created_at)}</td>
        <td>${o.service_name || `Cluster Service [ID: ${o.service_id}]`}</td>
        <td><a href="${o.link}" target="_blank" style="color: var(--accent); text-decoration: none; word-break: break-all;">${o.link}</a></td>
        <td>${o.quantity}</td>
        <td style="font-weight: 600; color: var(--success);">${formatMoneySystemValue(o.price)}</td>
        <td><span class="badge badge-${o.status.toLowerCase().replace(/\s+/g, '')}">${o.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`; }
}

// System Administration View Interfaces Elements Controls
function displayAdminAuthenticationView() {
  document.getElementById("admin-auth-view").classList.remove("d-none");
  document.getElementById("admin-app-view").classList.add("d-none");
}

function
