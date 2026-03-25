var authTabs = document.querySelectorAll("[data-auth-mode]");
var authEmail = document.getElementById("authEmail");
var authOtp = document.getElementById("authOtp");
var authPassword = document.getElementById("authPassword");
var authHelper = document.getElementById("authHelper");
var authSubmit = document.getElementById("authSubmit");
var authNote = document.getElementById("authNote");
var authStatus = document.getElementById("authStatus");
var signupFields = document.getElementById("signupFields");
var authOtpFields = document.getElementById("authOtpFields");
var requestOtpButton = document.getElementById("requestOtpButton");
var profileModal = document.getElementById("profileModal");
var profileForm = document.getElementById("profileForm");
var profileStatus = document.getElementById("profileStatus");
var resultPanel = document.getElementById("result");
var protectedLinks = document.querySelectorAll(".protected-link");
var headerLogin = document.getElementById("headerLogin");
var headerSignup = document.getElementById("headerSignup");
var termsTrigger = document.getElementById("termsTrigger");
var termsModal = document.getElementById("termsModal");
var termsClose = document.getElementById("termsClose");
var loginRequiredModal = document.getElementById("loginRequiredModal");
var loginRequiredClose = document.getElementById("loginRequiredClose");
var loginRequiredAction = document.getElementById("loginRequiredAction");
var VISITOR_KEY = "symptoscan_visitor_id";
var AUTH_KEY = "symptoscan_auth_session";
var authMode = "login";
var authSession = loadAuthSession();

function getVisitorId() {
    var existing = localStorage.getItem(VISITOR_KEY);
    if (existing) {
        return existing;
    }

    var generated = "visitor_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VISITOR_KEY, generated);
    return generated;
}

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

function updateAuthNote() {
    if (!authNote) {
        return;
    }

    if (authSession && authSession.user) {
        authNote.textContent = authSession.user.profileComplete
            ? "Signed in already. Opening your private dashboard."
            : "Signed in. Finish your personal details to continue to the dashboard.";
        return;
    }

    authNote.textContent = authMode === "signup"
        ? "Sign up with email, OTP, and one password that you will use later to log in."
        : "Login OTP will be sent to your registered email address.";
}

function setAuthMode(mode) {
    authMode = mode;

    authTabs.forEach(function (tab) {
        tab.classList.toggle("is-active", tab.getAttribute("data-auth-mode") === mode);
    });

    if (signupFields) {
        signupFields.hidden = mode !== "signup";
    }

    if (authOtpFields) {
        authOtpFields.hidden = false;
    }

    if (authHelper) {
        authHelper.hidden = mode !== "signup";
    }

    if (authPassword) {
        authPassword.value = "";
        authPassword.placeholder = "Create your password";
    }

    if (authSubmit) {
        authSubmit.textContent = mode === "signup" ? "Sign up with Email" : "Login with OTP";
    }

    if (requestOtpButton) {
        requestOtpButton.textContent = mode === "signup" ? "Get signup OTP" : "Get login OTP";
    }

    if (headerLogin) {
        headerLogin.classList.toggle("is-selected", mode === "login");
    }

    if (headerSignup) {
        headerSignup.classList.toggle("secondary", mode !== "signup");
        headerSignup.classList.toggle("primary", mode === "signup");
    }

    if (authOtp) {
        authOtp.value = "";
    }

    setStatus(authStatus, "success", "");
    updateAuthNote();
}

function focusAuthPanel() {
    if (authEmail) {
        authEmail.focus();
    }
}

function openLoginRequiredModal(event) {
    if (event) {
        event.preventDefault();
    }

    if (!loginRequiredModal) {
        return;
    }

    loginRequiredModal.classList.add("is-open");
    loginRequiredModal.setAttribute("aria-hidden", "false");
}

function closeLoginRequiredModal() {
    if (!loginRequiredModal) {
        return;
    }

    loginRequiredModal.classList.remove("is-open");
    loginRequiredModal.setAttribute("aria-hidden", "true");
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

function openProfileModal() {
    if (!profileModal) {
        return;
    }

    fillProfileForm(authSession && authSession.user);
    setStatus(profileStatus, "success", "");
    profileModal.classList.add("is-open");
    profileModal.setAttribute("aria-hidden", "false");
}

function closeProfileModal() {
    if (!profileModal) {
        return;
    }

    profileModal.classList.remove("is-open");
    profileModal.setAttribute("aria-hidden", "true");
}

function goToDashboard() {
    window.location.href = "/app.html";
}

function identifyVisitor() {
    postJson("/api/users/identify", {
        visitorId: getVisitorId(),
        email: authSession && authSession.user ? authSession.user.email : ""
    }, false).catch(function () {
        return null;
    });
}

function requestSignupOtp() {
    var email = authEmail.value.trim();

    if (!email) {
        setStatus(authStatus, "error", "Enter your email first, then request the OTP.");
        return;
    }

    requestOtpButton.disabled = true;
    setStatus(authStatus, "success", "Requesting OTP...");

    postJson("/api/auth/request-otp", {
        email: email,
        purpose: authMode === "signup" ? "signup" : "login",
        visitorId: getVisitorId()
    }, false).then(function (data) {
        var message = "OTP generated for " + email + ".";
        if (data.delivery === "demo" && data.otp) {
            message += " Demo OTP: " + data.otp;
        }
        setStatus(authStatus, "success", message);
    }).catch(function (error) {
        setStatus(authStatus, "error", error.message);
    }).finally(function () {
        requestOtpButton.disabled = false;
    });
}

function handleAuthSuccess(session, successMessage) {
    saveAuthSession(session);
    updateAuthNote();
    setStatus(authStatus, "success", successMessage);
    identifyVisitor();

    if (!session.user.profileComplete) {
        openProfileModal();
        return;
    }

    goToDashboard();
}

function submitAuth() {
    var email = authEmail.value.trim();
    var otp = authOtp.value.trim();

    if (!email) {
        setStatus(authStatus, "error", "Email is required.");
        return;
    }

    authSubmit.disabled = true;
    setStatus(authStatus, "success", authMode === "signup" ? "Creating your account..." : "Logging you in...");

    if (authMode === "signup") {
        var password = authPassword.value.trim();

        if (!otp || !password) {
            authSubmit.disabled = false;
            setStatus(authStatus, "error", "Enter the OTP and create your password.");
            return;
        }

        postJson("/api/auth/signup", {
            email: email,
            otp: otp,
            password: password,
            visitorId: getVisitorId()
        }, false).then(function (data) {
            handleAuthSuccess(data.session, "Account created. Now complete your personal details.");
        }).catch(function (error) {
            setStatus(authStatus, "error", error.message);
        }).finally(function () {
            authSubmit.disabled = false;
        });

        return;
    }

    if (!otp) {
        authSubmit.disabled = false;
        setStatus(authStatus, "error", "Enter the OTP that was sent to your email.");
        return;
    }

    postJson("/api/auth/login-otp", {
        email: email,
        otp: otp
    }, false).then(function (data) {
        handleAuthSuccess(data.session, "Login successful.");
    }).catch(function (error) {
        setStatus(authStatus, "error", error.message);
    }).finally(function () {
        authSubmit.disabled = false;
    });
}

function saveProfile(event) {
    event.preventDefault();
    var selectedGender = document.getElementById("profileGender").value;

    if (!authSession || !authSession.token) {
        setStatus(profileStatus, "error", "Log in first before saving profile details.");
        return;
    }

    if (!selectedGender) {
        setStatus(profileStatus, "error", "Please select your gender before continuing.");
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
        updateAuthNote();
        setStatus(profileStatus, "success", "Profile saved successfully.");
        setTimeout(function () {
            closeProfileModal();
            goToDashboard();
        }, 400);
    }).catch(function (error) {
        setStatus(profileStatus, "error", error.message);
    });
}

function openTermsModal(event) {
    event.preventDefault();
    termsModal.classList.add("is-open");
    termsModal.setAttribute("aria-hidden", "false");
}

function closeTermsModal() {
    termsModal.classList.remove("is-open");
    termsModal.setAttribute("aria-hidden", "true");
}

if (authTabs.length) {
    authTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            setAuthMode(tab.getAttribute("data-auth-mode"));
        });
    });
}

if (requestOtpButton) {
    requestOtpButton.addEventListener("click", requestSignupOtp);
}

if (authSubmit) {
    authSubmit.addEventListener("click", submitAuth);
}

if (headerLogin) {
    headerLogin.addEventListener("click", function (event) {
        event.preventDefault();
        setAuthMode("login");
        focusAuthPanel();
    });
}

if (headerSignup) {
    headerSignup.addEventListener("click", function () {
        setAuthMode("signup");
        focusAuthPanel();
    });
}

if (protectedLinks.length) {
    protectedLinks.forEach(function (link) {
        link.addEventListener("click", openLoginRequiredModal);
    });
}

if (loginRequiredClose) {
    loginRequiredClose.addEventListener("click", closeLoginRequiredModal);
}

if (loginRequiredAction) {
    loginRequiredAction.addEventListener("click", function () {
        closeLoginRequiredModal();
        setAuthMode("login");
        focusAuthPanel();
    });
}

if (profileForm) {
    profileForm.addEventListener("submit", saveProfile);
}

if (termsTrigger && termsModal && termsClose) {
    termsTrigger.addEventListener("click", openTermsModal);
    termsClose.addEventListener("click", closeTermsModal);

    termsModal.addEventListener("click", function (event) {
        if (event.target === termsModal) {
            closeTermsModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && termsModal.classList.contains("is-open")) {
            closeTermsModal();
        }
    });
}

if (loginRequiredModal) {
    loginRequiredModal.addEventListener("click", function (event) {
        if (event.target === loginRequiredModal) {
            closeLoginRequiredModal();
        }
    });
}

setAuthMode("login");
updateAuthNote();
identifyVisitor();

if (authSession && authSession.user) {
    authEmail.value = authSession.user.email || "";
    if (resultPanel) {
        resultPanel.textContent = authSession.user.profileComplete
            ? "You are already signed in. Opening your dashboard."
            : "Finish your personal details to continue to your dashboard.";
    }
    if (authSession.user.profileComplete) {
        goToDashboard();
    } else {
        openProfileModal();
    }
}
