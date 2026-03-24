var symptomsInput = document.getElementById("symptoms");
var resultPanel = document.getElementById("result");
var pasteZone = document.getElementById("imagePasteZone");
var previewImage = document.getElementById("heroPreview");
var imageOverlay = document.getElementById("imageOverlay");
var imageUpload = document.getElementById("imageUpload");
var uploadButton = document.getElementById("uploadButton");
var termsTrigger = document.getElementById("termsTrigger");
var termsModal = document.getElementById("termsModal");
var termsClose = document.getElementById("termsClose");
var VISITOR_KEY = "symptoscan_visitor_id";

function getVisitorId() {
    var existing = localStorage.getItem(VISITOR_KEY);
    if (existing) {
        return existing;
    }

    var generated = "visitor_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VISITOR_KEY, generated);
    return generated;
}

function postJson(url, payload) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
}

function identifyVisitor() {
    postJson("/api/users/identify", {
        visitorId: getVisitorId()
    }).catch(function () {
        return null;
    });
}

function logSearch(symptoms, result) {
    postJson("/api/searches", {
        visitorId: getVisitorId(),
        symptoms: symptoms,
        result: result
    }).catch(function () {
        return null;
    });
}

function checkHealth() {
    var symptoms = symptomsInput.value.trim();

    if (!symptoms) {
        resultPanel.textContent = "Enter symptoms to see a likely condition.";
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
    } else if (
        text.includes("stomach") ||
        text.includes("nausea") ||
        text.includes("vomit") ||
        text.includes("vomiting")
    ) {
        condition = "Likely condition: Stomach infection or food poisoning";
    } else if (text.includes("sore throat") || text.includes("throat pain")) {
        condition = "Likely condition: Throat infection or tonsillitis";
    } else if (text.includes("runny nose") || text.includes("sneezing") || text.includes("cold")) {
        condition = "Likely condition: Common cold or seasonal allergy";
    } else if (text.includes("body pain") || text.includes("body ache") || text.includes("muscle pain")) {
        condition = "Likely condition: Viral fever or body inflammation";
    }

    resultPanel.textContent = condition;
    logSearch(symptoms, condition);
}

function setPreviewFromFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        return;
    }

    var reader = new FileReader();
    reader.onload = function (event) {
        previewImage.src = event.target.result;
        pasteZone.classList.add("has-image");
        imageOverlay.querySelector("h3").textContent = "Your image is live";
        imageOverlay.querySelector("p").textContent = "Paste again or choose another file to replace it.";
    };
    reader.readAsDataURL(file);
}

pasteZone.addEventListener("click", function () {
    pasteZone.focus();
});

uploadButton.addEventListener("click", function (event) {
    event.stopPropagation();
    imageUpload.click();
});

imageUpload.addEventListener("change", function () {
    if (imageUpload.files && imageUpload.files[0]) {
        setPreviewFromFile(imageUpload.files[0]);
    }
});

pasteZone.addEventListener("paste", function (event) {
    var items = event.clipboardData && event.clipboardData.items;
    if (!items) {
        return;
    }

    for (var index = 0; index < items.length; index += 1) {
        var item = items[index];
        if (item.type.indexOf("image/") === 0) {
            event.preventDefault();
            setPreviewFromFile(item.getAsFile());
            return;
        }
    }
});

function openTermsModal(event) {
    event.preventDefault();
    termsModal.classList.add("is-open");
    termsModal.setAttribute("aria-hidden", "false");
}

function closeTermsModal() {
    termsModal.classList.remove("is-open");
    termsModal.setAttribute("aria-hidden", "true");
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

identifyVisitor();
