const ADMIN_AUTH_KEY = "symptoscan_admin_session";

function loadAdminSession() {
    try {
        const raw = localStorage.getItem(ADMIN_AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function saveAdminSession(session) {
    localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(session));
}

function clearAdminSession() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
}

function buildHeaders() {
    const session = loadAdminSession();
    const headers = {};
    if (session && session.token) {
        headers.Authorization = `Bearer ${session.token}`;
    }
    return headers;
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: buildHeaders()
    });
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload || {})
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

function formatDate(value) {
    if (!value) {
        return "--";
    }

    return new Date(value).toLocaleString();
}

function setStatusValue(elementId, enabled) {
    const element = document.getElementById(elementId);
    element.textContent = enabled ? "Yes" : "No";
    element.className = enabled ? "status-ok" : "status-warn";
}

function fillTable(elementId, rows, renderRow, columns) {
    const element = document.getElementById(elementId);
    element.innerHTML = rows.length
        ? rows.map(renderRow).join("")
        : `<tr><td colspan="${columns}">No data yet.</td></tr>`;
}

async function loadAdminDashboard() {
    const [overviewRes, usersRes, searchesRes, eventsRes] = await Promise.all([
        fetchJson("/api/admin/overview"),
        fetchJson("/api/admin/users"),
        fetchJson("/api/admin/searches"),
        fetchJson("/api/admin/events")
    ]);

    const overview = overviewRes.overview;
    document.getElementById("usersCount").textContent = overview.usersCount;
    document.getElementById("searchesCount").textContent = overview.searchesCount;
    document.getElementById("otpCount").textContent = overview.otpRequestsCount;
    document.getElementById("profilesCount").textContent = overview.profilesCompleteCount || 0;
    document.getElementById("usageCount").textContent = overview.totalUsageCount || 0;

    const systemStatus = overview.systemStatus || {};
    document.getElementById("adminLinkValue").textContent = systemStatus.adminPath || "/admin.html";
    document.getElementById("otpProviderValue").textContent = systemStatus.otpProvider || "demo";
    setStatusValue("resendStatus", Boolean(systemStatus.resendConfigured));
    setStatusValue("gmailStatus", Boolean(systemStatus.gmailConfigured));
    setStatusValue("geminiStatus", Boolean(systemStatus.geminiConfigured));
    setStatusValue("infermedicaStatus", Boolean(systemStatus.infermedicaConfigured));
    setStatusValue("googlePlacesStatus", Boolean(systemStatus.googlePlacesConfigured));

    fillTable("usersTable", usersRes.users, user => `
        <tr>
            <td>${user.email || "--"}</td>
            <td>${user.name || "--"}</td>
            <td>${user.phoneNumber || "--"}</td>
            <td>${user.bloodGroup || "--"}</td>
            <td>${user.usageCount || 0}</td>
            <td>${user.searchesCount || 0}</td>
            <td>${formatDate(user.lastSeenAt)}</td>
        </tr>
    `, 7);

    fillTable("searchesTable", searchesRes.searches, search => `
        <tr>
            <td>${search.name || "--"}</td>
            <td>${search.email || "--"}</td>
            <td>${search.symptoms || "--"}</td>
            <td>${search.result || "--"}</td>
            <td>${formatDate(search.timestamp)}</td>
        </tr>
    `, 5);

    fillTable("eventsTable", eventsRes.events, event => `
        <tr>
            <td>${event.type}</td>
            <td>${event.email || "--"}</td>
            <td>${event.detail || "--"}</td>
            <td>${formatDate(event.timestamp)}</td>
        </tr>
    `, 4);
}

function showDashboard() {
    document.getElementById("adminLoginWrap").hidden = true;
    document.getElementById("adminDashboard").hidden = false;
}

function showLogin() {
    document.getElementById("adminLoginWrap").hidden = false;
    document.getElementById("adminDashboard").hidden = true;
}

document.getElementById("adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const status = document.getElementById("adminLoginStatus");
    status.textContent = "";

    try {
        const data = await postJson("/api/admin/login", {
            email: document.getElementById("adminEmail").value.trim(),
            password: document.getElementById("adminPassword").value.trim()
        });
        saveAdminSession(data.session);
        showDashboard();
        await loadAdminDashboard();
    } catch (error) {
        status.textContent = error.message;
    }
});

document.getElementById("refreshButton").addEventListener("click", loadAdminDashboard);
document.getElementById("adminLogoutButton").addEventListener("click", () => {
    clearAdminSession();
    showLogin();
});

if (loadAdminSession()) {
    showDashboard();
    loadAdminDashboard().catch(error => {
        console.error(error);
        clearAdminSession();
        showLogin();
        alert("Admin session expired or backend is not running.");
    });
} else {
    showLogin();
}
