async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

function formatDate(value) {
    if (!value) {
        return "--";
    }

    return new Date(value).toLocaleString();
}

function fillTable(elementId, rows, renderRow) {
    const element = document.getElementById(elementId);
    element.innerHTML = rows.length
        ? rows.map(renderRow).join("")
        : '<tr><td colspan="4">No data yet.</td></tr>';
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
    document.getElementById("latestEvent").textContent = overview.latestEvent ? overview.latestEvent.type : "--";

    fillTable("usersTable", usersRes.users, user => `
        <tr>
            <td>${user.email || "--"}</td>
            <td>${user.visitorId || "--"}</td>
            <td>${user.searchesCount || 0}</td>
            <td>${formatDate(user.lastSeenAt)}</td>
        </tr>
    `);

    fillTable("searchesTable", searchesRes.searches, search => `
        <tr>
            <td>${search.email || "--"}</td>
            <td>${search.symptoms || "--"}</td>
            <td>${search.result || "--"}</td>
            <td>${formatDate(search.timestamp)}</td>
        </tr>
    `);

    fillTable("eventsTable", eventsRes.events, event => `
        <tr>
            <td>${event.type}</td>
            <td>${event.email || "--"}</td>
            <td>${event.detail || "--"}</td>
            <td>${formatDate(event.timestamp)}</td>
        </tr>
    `);
}

document.getElementById("refreshButton").addEventListener("click", loadAdminDashboard);
loadAdminDashboard().catch(error => {
    console.error(error);
    alert("Could not load admin data. Start the backend with `npm start` first.");
});
