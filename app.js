var symptomsInput = document.getElementById("symptoms");
var resultPanel = document.getElementById("result");
var analyzeButton = document.getElementById("analyzeButton");
var profileTrigger = document.getElementById("profileTrigger");
var profileDropdown = document.getElementById("profileDropdown");
var myProfileButton = document.getElementById("myProfileButton");
var signOutButton = document.getElementById("signOutButton");
var profileAvatar = document.getElementById("profileAvatar");
var profileModal = document.getElementById("profileModal");
var profileForm = document.getElementById("profileForm");
var profileStatus = document.getElementById("profileStatus");
var accountModal = document.getElementById("accountModal");
var accountClose = document.getElementById("accountClose");
var accountEditProfileButton = document.getElementById("accountEditProfileButton");
var historyList = document.getElementById("historyList");
var summaryName = document.getElementById("summaryName");
var summaryEmail = document.getElementById("summaryEmail");
var summaryBloodGroup = document.getElementById("summaryBloodGroup");
var summaryPhone = document.getElementById("summaryPhone");
var summaryGender = document.getElementById("summaryGender");
var summaryLocation = document.getElementById("summaryLocation");
var AUTH_KEY = "symptoscan_auth_session";
var VISITOR_KEY = "symptoscan_visitor_id";
var authSession = loadAuthSession();

function loadAuthSession() {
    try {
        var raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function saveAuthSession(session) {
    authSession = session;
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

function clearAuthSession() {
    authSession = null;
    localStorage.removeItem(AUTH_KEY);
}

function getVisitorId() {
    var existing = localStorage.getItem(VISITOR_KEY);
    if (existing) {
        return existing;
    }

    var generated = "visitor_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VISITOR_KEY, generated);
    return generated;
}

function getUserInitial(user) {
    var source = (user && (user.name || user.email || "")).trim();
    return source ? source.charAt(0).toUpperCase() : "S";
}

function setStatus(element, type, message) {
    if (!element) {
        return;
    }

    if (!message) {
        element.hidden = true;
        element.className = "auth-status";
        element.textContent = "";
        return;
    }

    element.hidden = false;
    element.className = "auth-status " + (type === "error" ? "is-error" : "is-success");
    element.textContent = message;
}

function buildHeaders(includeAuth) {
    var headers = {
        "Content-Type": "application/json"
    };

    if (includeAuth && authSession && authSession.token) {
        headers.Authorization = "Bearer " + authSession.token;
    }

    return headers;
}

function postJson(url, payload, includeAuth) {
    return fetch(url, {
        method: "POST",
        headers: buildHeaders(includeAuth),
        body: JSON.stringify(payload || {})
    }).then(function (response) {
        return response.json().then(function (data) {
            if (!response.ok) {
                throw new Error(data.error || "Request failed.");
            }

            return data;
        });
    });
}

function fetchJson(url, includeAuth) {
    return fetch(url, {
        method: "GET",
        headers: includeAuth ? buildHeaders(true) : undefined
    }).then(function (response) {
        return response.json().then(function (data) {
            if (!response.ok) {
                throw new Error(data.error || "Request failed.");
            }

            return data;
        });
    });
}

function deleteJson(url, includeAuth) {
    return fetch(url, {
        method: "DELETE",
        headers: includeAuth ? buildHeaders(true) : undefined
    }).then(function (response) {
        return response.json().then(function (data) {
            if (!response.ok) {
                throw new Error(data.error || "Request failed.");
            }

            return data;
        });
    });
}

function goHome() {
    window.location.href = "/";
}

function fillProfileForm(user) {
    if (!profileForm || !user) {
        return;
    }

    var profile = user.profile || {};
    document.getElementById("profileName").value = profile.name || user.name || "";
    document.getElementById("profileGender").value = profile.gender || "";
    document.getElementById("profilePhone").value = profile.phoneNumber || "";
    document.getElementById("profileAge").value = profile.age || "";
    document.getElementById("profileBloodGroup").value = profile.bloodGroup || "";
    document.getElementById("profileLocation").value = profile.location || "";
    document.getElementById("profileEmergency").value = profile.emergencyContact || "";
    document.getElementById("profileDob").value = profile.dateOfBirth || "";
}

function updateSummary() {
    if (!authSession || !authSession.user) {
        return;
    }

    var user = authSession.user;
    var profile = user.profile || {};

    profileAvatar.textContent = getUserInitial(user);
    summaryName.textContent = profile.name || user.name || "--";
    summaryEmail.textContent = user.email || "--";
    summaryBloodGroup.textContent = profile.bloodGroup || "--";
    summaryPhone.textContent = profile.phoneNumber || "--";
    summaryGender.textContent = profile.gender || "--";
    summaryLocation.textContent = profile.location || "--";
}

function closeProfileDropdown() {
    if (!profileDropdown || !profileTrigger) {
        return;
    }

    profileDropdown.hidden = true;
    profileTrigger.setAttribute("aria-expanded", "false");
}

function toggleProfileDropdown() {
    var willOpen = profileDropdown.hidden;
    profileDropdown.hidden = !willOpen;
    profileTrigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function openProfileModal() {
    fillProfileForm(authSession && authSession.user);
    setStatus(profileStatus, "success", "");
    profileModal.classList.add("is-open");
    profileModal.setAttribute("aria-hidden", "false");
}

function closeProfileModal() {
    profileModal.classList.remove("is-open");
    profileModal.setAttribute("aria-hidden", "true");
}

function openAccountModal() {
    if (!accountModal) {
        return;
    }

    updateSummary();
    accountModal.classList.add("is-open");
    accountModal.setAttribute("aria-hidden", "false");
}

function closeAccountModal() {
    if (!accountModal) {
        return;
    }

    accountModal.classList.remove("is-open");
    accountModal.setAttribute("aria-hidden", "true");
}

function renderHistory(searches) {
    if (!historyList) {
        return;
    }

    if (!searches || !searches.length) {
        historyList.innerHTML = '<div class="history-empty">Your past symptom checks will appear here.</div>';
        return;
    }

    historyList.innerHTML = searches.map(function (search) {
        var symptoms = search.symptoms || "--";
        var result = search.result || "--";
        var timestamp = search.timestamp ? new Date(search.timestamp).toLocaleString() : "";
        return '' +
            '<article class="history-card" data-search-id="' + search.id + '">' +
                '<div class="history-card-top">' +
                    '<strong>' + symptoms.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</strong>' +
                    '<button class="history-delete" type="button" data-delete-id="' + search.id + '">Delete</button>' +
                '</div>' +
                '<p>' + result.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</p>' +
                '<span>' + timestamp + '</span>' +
            '</article>';
    }).join("");
}

function loadSearchHistory() {
    fetchJson("/api/my/searches", true).then(function (data) {
        renderHistory(data.searches || []);
    }).catch(function () {
        renderHistory([]);
    });
}

function deleteSearch(searchId) {
    deleteJson("/api/my/searches/" + encodeURIComponent(searchId), true).then(function () {
        loadSearchHistory();
    }).catch(function (error) {
        resultPanel.textContent = error.message;
    });
}

function saveProfile(event) {
    event.preventDefault();
    var selectedGender = document.getElementById("profileGender").value;

    if (!selectedGender) {
        setStatus(profileStatus, "error", "Please select your gender before saving.");
        return;
    }

    var payload = {
        name: document.getElementById("profileName").value.trim(),
        gender: selectedGender,
        phoneNumber: document.getElementById("profilePhone").value.trim(),
        age: document.getElementById("profileAge").value.trim(),
        bloodGroup: document.getElementById("profileBloodGroup").value.trim(),
        location: document.getElementById("profileLocation").value.trim(),
        emergencyContact: document.getElementById("profileEmergency").value.trim(),
        dateOfBirth: document.getElementById("profileDob").value
    };

    setStatus(profileStatus, "success", "Saving your details...");

    postJson("/api/profile", payload, true).then(function (data) {
        saveAuthSession(data.session);
        updateSummary();
        setStatus(profileStatus, "success", "Profile updated.");
        setTimeout(closeProfileModal, 400);
    }).catch(function (error) {
        setStatus(profileStatus, "error", error.message);
    });
}

function checkHealth() {
    var symptoms = symptomsInput.value.trim();

    if (!symptoms) {
        resultPanel.textContent = "Describe your symptoms to get a likely condition.";
        return;
    }

    var text = symptoms.toLowerCase();
    var condition = "Likely condition: Common viral illness";

    if (text.includes("chest pain") || text.includes("trouble breathing") || text.includes("shortness of breath")) {
        condition = "Likely condition: Respiratory distress or a serious chest-related condition";
    } else if (text.includes("fever") || text.includes("cough")) {
        condition = "Likely condition: Flu or viral fever";
    } else if (text.includes("headache") || text.includes("fatigue")) {
        condition = "Likely condition: Migraine, stress-related fatigue, or viral weakness";
    } else if (text.includes("stomach") || text.includes("nausea") || text.includes("vomit") || text.includes("vomiting")) {
        condition = "Likely condition: Stomach infection or food poisoning";
    } else if (text.includes("sore throat") || text.includes("throat pain")) {
        condition = "Likely condition: Throat infection or tonsillitis";
    } else if (text.includes("runny nose") || text.includes("sneezing") || text.includes("cold")) {
        condition = "Likely condition: Common cold or seasonal allergy";
    } else if (text.includes("body pain") || text.includes("body ache") || text.includes("muscle pain")) {
        condition = "Likely condition: Viral fever or body inflammation";
    }

    resultPanel.textContent = condition;

    postJson("/api/searches", {
        visitorId: getVisitorId(),
        email: authSession.user.email,
        symptoms: symptoms,
        result: condition
    }, true).then(function () {
        loadSearchHistory();
    }).catch(function () {
        return null;
    });
}

function signOut() {
    clearAuthSession();
    goHome();
}

if (!authSession || !authSession.user) {
    goHome();
} else if (!authSession.user.profileComplete) {
    goHome();
} else {
    updateSummary();
    loadSearchHistory();
}

if (analyzeButton) {
    analyzeButton.addEventListener("click", checkHealth);
}

if (profileTrigger) {
    profileTrigger.addEventListener("click", toggleProfileDropdown);
}

if (myProfileButton) {
    myProfileButton.addEventListener("click", function () {
        closeProfileDropdown();
        openAccountModal();
    });
}

if (signOutButton) {
    signOutButton.addEventListener("click", signOut);
}

if (profileForm) {
    profileForm.addEventListener("submit", saveProfile);
}

if (accountClose) {
    accountClose.addEventListener("click", closeAccountModal);
}

if (accountEditProfileButton) {
    accountEditProfileButton.addEventListener("click", function () {
        closeAccountModal();
        openProfileModal();
    });
}

document.addEventListener("click", function (event) {
    if (profileTrigger && profileDropdown && !profileTrigger.parentElement.contains(event.target)) {
        closeProfileDropdown();
    }

    if (accountModal && event.target === accountModal) {
        closeAccountModal();
    }

    if (historyList) {
        var deleteButton = event.target.closest("[data-delete-id]");
        if (deleteButton) {
            deleteSearch(deleteButton.getAttribute("data-delete-id"));
        }
    }
});
