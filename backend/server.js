const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

loadLocalEnvFile();

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = process.env.PORT || 3000;
const OTP_EMAIL_PROVIDER = (process.env.OTP_EMAIL_PROVIDER || "").trim().toLowerCase();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || "").trim();
const GMAIL_EMAIL = (process.env.GMAIL_EMAIL || "").trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").trim();
const OTP_FROM_NAME = (process.env.OTP_FROM_NAME || "SymptoScan").trim();
const ADMIN_EMAIL = normalizeAdminValue(process.env.ADMIN_EMAIL) || "admin@symptoscan.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "admin123").trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
const INFERMEDICA_APP_ID = (process.env.INFERMEDICA_APP_ID || "").trim();
const INFERMEDICA_APP_KEY = (process.env.INFERMEDICA_APP_KEY || "").trim();
const GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY || "").trim();

let gmailTransporter = null;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function loadLocalEnvFile() {
    const envFile = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envFile)) {
        return;
    }

    const envContent = fs.readFileSync(envFile, "utf8");
    envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
            return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!(key in process.env)) {
            process.env[key] = value;
        }
    });
}

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
        writeDb({
            users: [],
            searches: [],
            otpSessions: [],
            sessions: [],
            adminSessions: [],
            events: []
        });
    }
}

function nowIso() {
    return new Date().toISOString();
}

function createId(prefix) {
    return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function hashPassword(password) {
    return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeAdminValue(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getMailProvider() {
    if (OTP_EMAIL_PROVIDER === "resend" && RESEND_API_KEY && RESEND_FROM_EMAIL) {
        return "resend";
    }

    if (OTP_EMAIL_PROVIDER === "gmail" && GMAIL_EMAIL && GMAIL_APP_PASSWORD) {
        return "gmail";
    }

    if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
        return "resend";
    }

    if (GMAIL_EMAIL && GMAIL_APP_PASSWORD) {
        return "gmail";
    }

    return "demo";
}

function getFromEmail() {
    if (getMailProvider() === "resend") {
        return RESEND_FROM_EMAIL;
    }

    if (getMailProvider() === "gmail") {
        return GMAIL_EMAIL;
    }

    return "demo@symptoscan.local";
}

function getFormattedFromAddress() {
    return `${OTP_FROM_NAME} <${getFromEmail()}>`;
}

function buildOtpEmail(email, otp) {
    return {
        subject: "Your SymptoScan OTP Code",
        text: `Your SymptoScan OTP is ${otp}. It will expire in 10 minutes.`,
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#15352f">
                <h2 style="margin-bottom:8px;">Your SymptoScan OTP</h2>
                <p>Hello,</p>
                <p>Use the OTP below to complete your signup:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:18px 0;">${otp}</p>
                <p>This code expires in 10 minutes.</p>
                <p>If you did not request this code, you can ignore this email.</p>
                <p style="margin-top:24px;">SymptoScan</p>
            </div>
        `
    };
}

function getGmailTransporter() {
    if (gmailTransporter) {
        return gmailTransporter;
    }

    gmailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: GMAIL_EMAIL,
            pass: GMAIL_APP_PASSWORD
        }
    });

    return gmailTransporter;
}

async function sendWithGmail(to, content) {
    const transporter = getGmailTransporter();
    const result = await transporter.sendMail({
        from: getFormattedFromAddress(),
        to,
        subject: content.subject,
        text: content.text,
        html: content.html
    });

    return {
        provider: "gmail",
        id: result.messageId || null
    };
}

async function sendWithResend(to, content) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: getFormattedFromAddress(),
            to: [to],
            subject: content.subject,
            html: content.html,
            text: content.text
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error((data && data.message) || "Resend email request failed.");
    }

    return {
        provider: "resend",
        id: data.id || null
    };
}

async function sendOtpEmail(email, otp) {
    const provider = getMailProvider();
    const content = buildOtpEmail(email, otp);

    if (provider === "resend") {
        return sendWithResend(email, content);
    }

    if (provider === "gmail") {
        return sendWithGmail(email, content);
    }

    return {
        provider: "demo",
        id: null
    };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
    return normalizeString(value).toLowerCase();
}

function normalizeSex(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === "male") {
        return "male";
    }

    if (normalized === "female") {
        return "female";
    }

    return "";
}

function normalizeAgeValue(value) {
    const age = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isFinite(age) || age <= 0) {
        return 0;
    }

    return age;
}

function createInterviewId() {
    return crypto.randomUUID ? crypto.randomUUID() : createId("interview");
}

async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("Received an invalid JSON response from an external service.");
    }
}

async function extractSymptomsWithGemini(symptoms) {
    if (!GEMINI_API_KEY) {
        return null;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: [
                                "Extract only the medical symptoms from the text below.",
                                "Return plain text as a short comma-separated list with no explanation.",
                                `Text: ${symptoms}`
                            ].join("\n")
                        }
                    ]
                }
            ]
        })
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || "Gemini symptom extraction failed.");
    }

    const candidate = data.candidates && data.candidates[0];
    const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    const text = part && typeof part.text === "string" ? part.text.trim() : "";
    return text || null;
}

async function generateCareAdviceWithGemini(symptoms, primaryCondition) {
    if (!GEMINI_API_KEY) {
        return "";
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: [
                                "You are writing brief symptom-support guidance for a health support app.",
                                "Do not claim a confirmed diagnosis.",
                                "Suggest only general self-care and common over-the-counter medicine options for a general adult when usually appropriate.",
                                "Do not include dosages.",
                                "Do not suggest antibiotics or prescription medicines.",
                                "Include red flags for when to see a doctor urgently.",
                                "Keep it concise and practical.",
                                `Likely condition: ${primaryCondition}`,
                                `User symptoms: ${symptoms}`
                            ].join("\n")
                        }
                    ]
                }
            ]
        })
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || "Gemini care guidance failed.");
    }

    const candidate = data.candidates && data.candidates[0];
    const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    const text = part && typeof part.text === "string" ? part.text.trim() : "";
    return text || "";
}

function buildInfermedicaHeaders(interviewId) {
    return {
        "App-Id": INFERMEDICA_APP_ID,
        "App-Key": INFERMEDICA_APP_KEY,
        "Interview-Id": interviewId,
        "Content-Type": "application/json"
    };
}

async function parseSymptomsWithInfermedica(symptomsText, ageValue, sex) {
    const interviewId = createInterviewId();
    const parseResponse = await fetch("https://api.infermedica.com/v3/parse", {
        method: "POST",
        headers: buildInfermedicaHeaders(interviewId),
        body: JSON.stringify({
            text: symptomsText,
            age: { value: ageValue },
            sex: sex || undefined,
            concept_types: ["symptom"],
            correct_spelling: true
        })
    });

    const parseData = await readJsonResponse(parseResponse);
    if (!parseResponse.ok) {
        throw new Error((parseData && parseData.message) || "Infermedica parse failed.");
    }

    const evidence = (parseData.mentions || []).map(function (mention) {
        return {
            id: mention.id,
            choice_id: mention.choice_id,
            source: "initial"
        };
    }).filter(function (mention) {
        return mention.id && mention.choice_id;
    });

    if (!evidence.length || !sex) {
        return {
            interviewId,
            parseData,
            diagnosisData: null,
            evidence
        };
    }

    const diagnosisResponse = await fetch("https://api.infermedica.com/v3/diagnosis", {
        method: "POST",
        headers: buildInfermedicaHeaders(interviewId),
        body: JSON.stringify({
            sex,
            age: {
                value: ageValue
            },
            evidence
        })
    });

    const diagnosisData = await readJsonResponse(diagnosisResponse);
    if (!diagnosisResponse.ok) {
        throw new Error((diagnosisData && diagnosisData.message) || "Infermedica diagnosis failed.");
    }

    return {
        interviewId,
        parseData,
        diagnosisData,
        evidence
    };
}

async function findNearbyDoctors(location) {
    if (!GOOGLE_MAPS_API_KEY || !location) {
        return [];
    }

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.googleMapsUri"
        },
        body: JSON.stringify({
            textQuery: `doctor near ${location}`,
            maxResultCount: 5
        })
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || "Google Places doctor search failed.");
    }

    return (data.places || []).map(function (place) {
        return {
            name: place.displayName && place.displayName.text ? place.displayName.text : "Doctor",
            address: place.formattedAddress || "",
            rating: place.rating || null,
            mapsUrl: place.googleMapsUri || ""
        };
    });
}

function buildFallbackCondition(symptoms) {
    const text = symptoms.toLowerCase();
    if (text.includes("chest pain") || text.includes("trouble breathing") || text.includes("shortness of breath")) {
        return "Respiratory distress or a serious chest-related condition";
    }

    if (text.includes("fever") || text.includes("cough")) {
        return "Flu or viral fever";
    }

    if (text.includes("headache") || text.includes("fatigue")) {
        return "Migraine, stress-related fatigue, or viral weakness";
    }

    if (text.includes("stomach") || text.includes("nausea") || text.includes("vomit") || text.includes("vomiting")) {
        return "Stomach infection or food poisoning";
    }

    if (text.includes("sore throat") || text.includes("throat pain")) {
        return "Throat infection or tonsillitis";
    }

    if (text.includes("runny nose") || text.includes("sneezing") || text.includes("cold")) {
        return "Common cold or seasonal allergy";
    }

    if (text.includes("body pain") || text.includes("body ache") || text.includes("muscle pain")) {
        return "Viral fever or body inflammation";
    }

    return "Common viral illness";
}

function buildFallbackCareAdvice(symptoms, primaryCondition) {
    const text = symptoms.toLowerCase();
    const lines = [];

    lines.push("Suggested care:");

    if (
        text.includes("sore throat") ||
        text.includes("throat pain") ||
        text.includes("gale") ||
        text.includes("swallow") ||
        text.includes("nigalte") ||
        text.includes("pain when drinking")
    ) {
        lines.push("- Warm water, warm tea, and salt-water gargles may help soothe the throat.");
        lines.push("- Rest your voice and avoid very cold, spicy, or irritating foods for now.");
        lines.push("- Common OTC options for adults that may help are acetaminophen/paracetamol or ibuprofen if these are normally safe for you.");
        lines.push("- Throat lozenges or soothing cough syrups may also help with throat discomfort.");
        lines.push("- Antibiotics are usually not helpful for a typical viral sore throat unless a doctor confirms a bacterial infection.");
        lines.push("- See a doctor urgently if you have trouble breathing, trouble swallowing saliva, severe swelling, dehydration, high fever, or symptoms that keep getting worse.");
        return lines.join("\n");
    }

    if (text.includes("fever") || text.includes("cough") || primaryCondition.toLowerCase().includes("viral")) {
        lines.push("- Rest, fluids, and light meals are usually the first step.");
        lines.push("- Common OTC options for adults that may help are acetaminophen/paracetamol or ibuprofen if these are normally safe for you.");
        lines.push("- Honey, warm fluids, and throat lozenges may help if you also have a cough or throat irritation.");
        lines.push("- Antibiotics do not treat viral illnesses and should not be started unless prescribed.");
        lines.push("- Seek medical care if you develop breathing trouble, dehydration, chest pain, fever lasting several days, or worsening symptoms.");
        return lines.join("\n");
    }

    if (text.includes("stomach") || text.includes("nausea") || text.includes("vomit") || text.includes("vomiting")) {
        lines.push("- Sip water or oral rehydration solution slowly and avoid oily or spicy foods.");
        lines.push("- Eat light foods only if you can tolerate them.");
        lines.push("- Avoid self-starting antibiotics unless a doctor prescribes them.");
        lines.push("- Seek medical care if vomiting is persistent, there is blood, severe abdominal pain, or signs of dehydration.");
        return lines.join("\n");
    }

    lines.push("- Rest, fluids, and simple symptom relief are usually the safest first steps.");
    lines.push("- For general adult pain or fever relief, common OTC options may include acetaminophen/paracetamol or ibuprofen if these are normally safe for you.");
    lines.push("- Avoid starting antibiotics unless a doctor confirms they are needed.");
    lines.push("- Please see a doctor promptly if symptoms are severe, unusual, or getting worse.");
    return lines.join("\n");
}

function formatAnalysisResult(summary) {
    const lines = [];

    lines.push(`Likely condition: ${summary.primaryCondition}`);

    if (summary.cleanedSymptoms) {
        lines.push(`Symptoms recognized: ${summary.cleanedSymptoms}`);
    }

    if (summary.careAdvice) {
        lines.push("");
        lines.push(summary.careAdvice);
    }

    if (summary.matches && summary.matches.length) {
        lines.push("");
        lines.push("Top possible causes:");
        summary.matches.slice(0, 3).forEach(function (match, index) {
            lines.push(`${index + 1}. ${match.name}${match.probabilityLabel ? ` (${match.probabilityLabel})` : ""}`);
        });
    }

    if (summary.doctors && summary.doctors.length) {
        lines.push("");
        lines.push("Nearby doctors:");
        summary.doctors.forEach(function (doctor, index) {
            lines.push(`${index + 1}. ${doctor.name}${doctor.address ? ` - ${doctor.address}` : ""}`);
        });
    }

    lines.push("");
    lines.push("This is informational support only and not a medical diagnosis.");

    return lines.join("\n");
}

async function analyzeSymptoms(payload, request) {
    const symptoms = normalizeString(payload.symptoms);
    if (!symptoms) {
        return { statusCode: 400, body: { ok: false, error: "Symptoms are required." } };
    }

    const db = readDb();
    const auth = getAuthenticatedUser(db, request);
    const user = auth ? auth.user : null;
    const location = normalizeString(payload.location) || (user && normalizeString(user.location)) || (user && user.profile && normalizeString(user.profile.location));
    const ageValue = normalizeAgeValue(payload.age) || (user && normalizeAgeValue(user.age)) || (user && user.profile && normalizeAgeValue(user.profile.age));
    const sex = normalizeSex(payload.gender) || (user && normalizeSex(user.gender)) || (user && user.profile && normalizeSex(user.profile.gender));

    const summary = {
        primaryCondition: buildFallbackCondition(symptoms),
        cleanedSymptoms: symptoms,
        matches: [],
        doctors: [],
        provider: "fallback",
        usedGemini: false,
        usedInfermedica: false,
        usedGooglePlaces: false,
        careAdvice: "",
        missingProfileData: {
            age: !ageValue,
            gender: !sex,
            location: !location
        }
    };

    try {
        const cleanedSymptoms = await extractSymptomsWithGemini(symptoms);
        if (cleanedSymptoms) {
            summary.cleanedSymptoms = cleanedSymptoms;
            summary.usedGemini = true;
        }
    } catch (error) {
        summary.geminiError = error.message;
    }

    if (INFERMEDICA_APP_ID && INFERMEDICA_APP_KEY && ageValue) {
        try {
            const infermedica = await parseSymptomsWithInfermedica(summary.cleanedSymptoms, ageValue, sex);
            const conditions = infermedica.diagnosisData && Array.isArray(infermedica.diagnosisData.conditions)
                ? infermedica.diagnosisData.conditions
                : [];

            if (conditions.length) {
                summary.matches = conditions.slice(0, 3).map(function (condition) {
                    return {
                        name: condition.common_name || condition.name || "Unknown condition",
                        probability: condition.probability || null,
                        probabilityLabel: typeof condition.probability === "number"
                            ? `${Math.round(condition.probability * 100)}%`
                            : ""
                    };
                });
                summary.primaryCondition = summary.matches[0].name;
                summary.provider = "infermedica";
                summary.usedInfermedica = true;
            }
        } catch (error) {
            summary.infermedicaError = error.message;
        }
    }

    try {
        summary.careAdvice = await generateCareAdviceWithGemini(symptoms, summary.primaryCondition);
    } catch (error) {
        summary.careAdviceError = error.message;
    }

    if (!summary.careAdvice) {
        summary.careAdvice = buildFallbackCareAdvice(symptoms, summary.primaryCondition);
    }

    if (location) {
        try {
            summary.doctors = await findNearbyDoctors(location);
            summary.usedGooglePlaces = summary.doctors.length > 0;
        } catch (error) {
            summary.googlePlacesError = error.message;
        }
    }

    const formattedResult = formatAnalysisResult(summary);
    const logPayload = {
        visitorId: normalizeString(payload.visitorId),
        email: user ? user.email : normalizeEmail(payload.email),
        symptoms,
        result: formattedResult
    };
    const logResult = logSearch(logPayload, request);

    return {
        statusCode: 200,
        body: {
            ok: true,
            analysis: summary,
            result: formattedResult,
            search: logResult.body.search
        }
    };
}

function isValidEmail(email) {
    return Boolean(email) && email.includes("@") && email.includes(".");
}

function getClientIp(request) {
    return request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown";
}

function normalizeUser(user) {
    const profile = user.profile || {};

    return {
        id: user.id || createId("user"),
        visitorId: user.visitorId || null,
        email: user.email || null,
        name: user.name || profile.name || null,
        location: user.location || profile.location || null,
        gender: user.gender || profile.gender || null,
        phoneNumber: user.phoneNumber || profile.phoneNumber || null,
        age: user.age || profile.age || null,
        bloodGroup: user.bloodGroup || profile.bloodGroup || null,
        emergencyContact: user.emergencyContact || profile.emergencyContact || null,
        dateOfBirth: user.dateOfBirth || profile.dateOfBirth || null,
        passwordHash: user.passwordHash || null,
        emailVerified: Boolean(user.emailVerified),
        profileComplete: Boolean(user.profileComplete),
        createdAt: user.createdAt || nowIso(),
        lastSeenAt: user.lastSeenAt || user.createdAt || nowIso(),
        searchesCount: Number(user.searchesCount || 0),
        usageCount: Number(user.usageCount || 0),
        ipAddress: user.ipAddress || null,
        profile: {
            name: user.name || profile.name || null,
            gender: user.gender || profile.gender || null,
            phoneNumber: user.phoneNumber || profile.phoneNumber || null,
            age: user.age || profile.age || null,
            bloodGroup: user.bloodGroup || profile.bloodGroup || null,
            location: user.location || profile.location || null,
            emergencyContact: user.emergencyContact || profile.emergencyContact || null,
            dateOfBirth: user.dateOfBirth || profile.dateOfBirth || null
        }
    };
}

function readDb() {
    ensureStorage();
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    db.users = Array.isArray(db.users) ? db.users.map(normalizeUser) : [];
    db.searches = Array.isArray(db.searches) ? db.searches : [];
    db.otpSessions = Array.isArray(db.otpSessions) ? db.otpSessions : [];
    db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
    db.adminSessions = Array.isArray(db.adminSessions) ? db.adminSessions : [];
    db.events = Array.isArray(db.events) ? db.events : [];

    return db;
}

function writeDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    response.end(JSON.stringify(data, null, 2));
}

function sendText(response, statusCode, text) {
    response.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(text);
}

function notFound(response) {
    sendText(response, 404, "Not found");
}

function parseBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";

        request.on("data", chunk => {
            body += chunk;
            if (body.length > 1_000_000) {
                reject(new Error("Request too large"));
            }
        });

        request.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON body"));
            }
        });

        request.on("error", reject);
    });
}

function recordEvent(db, event) {
    db.events.unshift({
        id: createId("event"),
        timestamp: nowIso(),
        userId: event.userId || null,
        email: event.email || null,
        type: event.type,
        detail: event.detail || ""
    });
    db.events = db.events.slice(0, 500);
}

function sanitizeUserForClient(user) {
    return {
        id: user.id,
        visitorId: user.visitorId,
        email: user.email,
        name: user.name,
        profileComplete: user.profileComplete,
        emailVerified: user.emailVerified,
        searchesCount: user.searchesCount,
        usageCount: user.usageCount,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        profile: {
            name: user.profile.name,
            gender: user.profile.gender,
            phoneNumber: user.profile.phoneNumber,
            age: user.profile.age,
            bloodGroup: user.profile.bloodGroup,
            location: user.profile.location,
            emergencyContact: user.profile.emergencyContact,
            dateOfBirth: user.profile.dateOfBirth
        }
    };
}

function sanitizeUserForAdmin(user) {
    return {
        id: user.id,
        visitorId: user.visitorId,
        email: user.email,
        name: user.name,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        age: user.age,
        bloodGroup: user.bloodGroup,
        location: user.location,
        emergencyContact: user.emergencyContact,
        dateOfBirth: user.dateOfBirth,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        searchesCount: user.searchesCount,
        usageCount: user.usageCount,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        ipAddress: user.ipAddress
    };
}

function getBearerToken(request) {
    const authHeader = request.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length).trim();
    }

    return "";
}

function createSession(db, user, request) {
    const token = createId("session");
    const session = {
        id: createId("auth"),
        token,
        userId: user.id,
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
        ipAddress: getClientIp(request)
    };

    db.sessions.unshift(session);
    db.sessions = db.sessions.slice(0, 1000);
    return session;
}

function createAdminSession(db, request) {
    const token = createId("admin_session");
    const session = {
        id: createId("admin_auth"),
        token,
        email: ADMIN_EMAIL,
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
        ipAddress: getClientIp(request)
    };

    db.adminSessions = Array.isArray(db.adminSessions) ? db.adminSessions : [];
    db.adminSessions.unshift(session);
    db.adminSessions = db.adminSessions.slice(0, 50);
    return session;
}

function getAuthenticatedUser(db, request) {
    const token = getBearerToken(request);
    if (!token) {
        return null;
    }

    const session = db.sessions.find(item => item.token === token);
    if (!session) {
        return null;
    }

    const user = db.users.find(item => item.id === session.userId);
    if (!user) {
        return null;
    }

    session.lastSeenAt = nowIso();
    user.lastSeenAt = nowIso();

    return { session, user };
}

function getAuthenticatedAdmin(db, request) {
    const token = getBearerToken(request);
    if (!token) {
        return null;
    }

    db.adminSessions = Array.isArray(db.adminSessions) ? db.adminSessions : [];
    const session = db.adminSessions.find(item => item.token === token);
    if (!session) {
        return null;
    }

    session.lastSeenAt = nowIso();
    return session;
}

function upsertUserInDb(db, payload, request) {
    const email = normalizeEmail(payload.email);
    const visitorId = normalizeString(payload.visitorId) || createId("visitor");

    let user = db.users.find(item => (email && item.email === email) || item.visitorId === visitorId);

    if (!user) {
        user = normalizeUser({
            id: createId("user"),
            visitorId,
            email: email || null,
            createdAt: nowIso(),
            lastSeenAt: nowIso(),
            ipAddress: getClientIp(request)
        });
        db.users.unshift(user);
    }

    user.visitorId = user.visitorId || visitorId;
    user.email = email || user.email;
    user.lastSeenAt = nowIso();
    user.ipAddress = getClientIp(request);
    user.usageCount += 1;

    if (normalizeString(payload.name)) {
        user.name = normalizeString(payload.name);
        user.profile.name = user.name;
    }

    if (normalizeString(payload.location)) {
        user.location = normalizeString(payload.location);
        user.profile.location = user.location;
    }

    return user;
}

async function requestOtp(payload, request) {
    const db = readDb();
    const email = normalizeEmail(payload.email);
    const purpose = normalizeString(payload.purpose) || "signup";

    if (!isValidEmail(email)) {
        return { statusCode: 400, body: { ok: false, error: "Valid email is required." } };
    }

    if (purpose === "login") {
        const user = db.users.find(item => item.email === email && item.passwordHash);
        if (!user) {
            return { statusCode: 400, body: { ok: false, error: "No account found for this email. Please sign up first." } };
        }
    }

    if (purpose === "signup") {
        const user = db.users.find(item => item.email === email && item.passwordHash);
        if (user) {
            return { statusCode: 400, body: { ok: false, error: "This email is already registered. Please log in." } };
        }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpSession = {
        id: createId("otp"),
        email,
        otp,
        verified: false,
        purpose,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        ipAddress: getClientIp(request)
    };

    const delivery = await sendOtpEmail(email, otp);

    db.otpSessions.unshift({
        ...otpSession,
        deliveryProvider: delivery.provider,
        deliveryId: delivery.id
    });
    db.otpSessions = db.otpSessions.slice(0, 500);

    recordEvent(db, {
        type: "otp_requested",
        email,
        detail: `${purpose} OTP requested via ${delivery.provider}`
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            expiresAt: otpSession.expiresAt,
            delivery: delivery.provider,
            otp: delivery.provider === "demo" ? otpSession.otp : undefined,
            note: delivery.provider === "demo"
                ? "Email delivery is not configured yet, so the OTP is returned directly for demo use."
                : `OTP sent successfully via ${delivery.provider}.`
        }
    };
}

function loginAdmin(payload, request) {
    const db = readDb();
    const email = normalizeAdminValue(payload.email);
    const password = String(payload.password || "").trim();

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return { statusCode: 401, body: { ok: false, error: "Invalid admin email or password." } };
    }

    const session = createAdminSession(db, request);
    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            session: {
                token: session.token,
                email: ADMIN_EMAIL
            }
        }
    };
}

function findOtpSession(db, email, otp, purpose) {
    return db.otpSessions.find(item => item.email === email && item.otp === otp && item.purpose === purpose && !item.verified);
}

function signupUser(payload, request) {
    const db = readDb();
    const email = normalizeEmail(payload.email);
    const otp = normalizeString(payload.otp);
    const password = normalizeString(payload.password);

    if (!isValidEmail(email)) {
        return { statusCode: 400, body: { ok: false, error: "Valid email is required." } };
    }

    if (!otp) {
        return { statusCode: 400, body: { ok: false, error: "OTP is required for sign up." } };
    }

    if (password.length < 6) {
        return { statusCode: 400, body: { ok: false, error: "Password must be at least 6 characters." } };
    }

    const existingUser = db.users.find(item => item.email === email);
    if (existingUser && existingUser.passwordHash) {
        return { statusCode: 400, body: { ok: false, error: "This email is already registered. Please log in." } };
    }

    const otpSession = findOtpSession(db, email, otp, "signup");
    if (!otpSession) {
        return { statusCode: 400, body: { ok: false, error: "Invalid OTP." } };
    }

    if (new Date(otpSession.expiresAt).getTime() < Date.now()) {
        return { statusCode: 400, body: { ok: false, error: "OTP expired. Request a new one." } };
    }

    otpSession.verified = true;

    const user = existingUser || upsertUserInDb(db, payload, request);
    user.email = email;
    user.passwordHash = hashPassword(password);
    user.emailVerified = true;
    user.lastSeenAt = nowIso();
    user.ipAddress = getClientIp(request);
    user.usageCount += 1;

    const session = createSession(db, user, request);

    recordEvent(db, {
        type: "signup_completed",
        userId: user.id,
        email,
        detail: "Email OTP signup completed"
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            session: {
                token: session.token,
                user: sanitizeUserForClient(user)
            }
        }
    };
}

function loginWithOtp(payload, request) {
    const db = readDb();
    const email = normalizeEmail(payload.email);
    const otp = normalizeString(payload.otp);

    if (!isValidEmail(email) || !otp) {
        return { statusCode: 400, body: { ok: false, error: "Email and OTP are required." } };
    }

    const user = db.users.find(item => item.email === email && item.passwordHash);
    if (!user) {
        return { statusCode: 400, body: { ok: false, error: "No account found for this email. Please sign up first." } };
    }

    const otpSession = findOtpSession(db, email, otp, "login");
    if (!otpSession) {
        return { statusCode: 400, body: { ok: false, error: "Invalid OTP." } };
    }

    if (new Date(otpSession.expiresAt).getTime() < Date.now()) {
        return { statusCode: 400, body: { ok: false, error: "OTP expired. Request a new one." } };
    }

    otpSession.verified = true;
    user.lastSeenAt = nowIso();
    user.ipAddress = getClientIp(request);
    user.usageCount += 1;

    const session = createSession(db, user, request);

    recordEvent(db, {
        type: "login_success",
        userId: user.id,
        email,
        detail: "User logged in with email OTP"
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            session: {
                token: session.token,
                user: sanitizeUserForClient(user)
            }
        }
    };
}

function loginUser(payload, request) {
    const db = readDb();
    const email = normalizeEmail(payload.email);
    const password = normalizeString(payload.password);

    if (!isValidEmail(email) || !password) {
        return { statusCode: 400, body: { ok: false, error: "Email and password are required." } };
    }

    const user = db.users.find(item => item.email === email);
    if (!user || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
        recordEvent(db, {
            type: "login_failed",
            email,
            detail: "Invalid email or password"
        });
        writeDb(db);
        return { statusCode: 401, body: { ok: false, error: "Invalid email or password." } };
    }

    user.lastSeenAt = nowIso();
    user.ipAddress = getClientIp(request);

    const session = createSession(db, user, request);

    recordEvent(db, {
        type: "login_success",
        userId: user.id,
        email,
        detail: "User logged in with email and password"
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            session: {
                token: session.token,
                user: sanitizeUserForClient(user)
            }
        }
    };
}

function updateProfile(payload, request) {
    const db = readDb();
    const auth = getAuthenticatedUser(db, request);

    if (!auth) {
        return { statusCode: 401, body: { ok: false, error: "Authentication required." } };
    }

    const user = auth.user;
    const profile = {
        name: normalizeString(payload.name),
        gender: normalizeString(payload.gender),
        phoneNumber: normalizeString(payload.phoneNumber),
        age: normalizeString(payload.age),
        bloodGroup: normalizeString(payload.bloodGroup),
        location: normalizeString(payload.location),
        emergencyContact: normalizeString(payload.emergencyContact),
        dateOfBirth: normalizeString(payload.dateOfBirth)
    };

    if (!profile.gender) {
        return { statusCode: 400, body: { ok: false, error: "Gender is required." } };
    }

    user.name = profile.name || user.name;
    user.gender = profile.gender || null;
    user.phoneNumber = profile.phoneNumber || null;
    user.age = profile.age || null;
    user.bloodGroup = profile.bloodGroup || null;
    user.location = profile.location || null;
    user.emergencyContact = profile.emergencyContact || null;
    user.dateOfBirth = profile.dateOfBirth || null;
    user.profile = profile;
    user.profileComplete = Boolean(user.name && user.gender && user.phoneNumber && user.bloodGroup);
    user.lastSeenAt = nowIso();
    user.ipAddress = getClientIp(request);
    user.usageCount += 1;

    recordEvent(db, {
        type: "profile_updated",
        userId: user.id,
        email: user.email,
        detail: "Profile details saved"
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            session: {
                token: auth.session.token,
                user: sanitizeUserForClient(user)
            }
        }
    };
}

function identifyUser(payload, request) {
    const db = readDb();
    const user = upsertUserInDb(db, payload, request);

    recordEvent(db, {
        type: "user_identified",
        userId: user.id,
        email: user.email,
        detail: "Frontend visitor identified"
    });

    writeDb(db);

    return {
        statusCode: 200,
        body: {
            ok: true,
            user: sanitizeUserForClient(user)
        }
    };
}

function logSearch(payload, request) {
    const db = readDb();
    const symptoms = normalizeString(payload.symptoms);
    const result = normalizeString(payload.result);

    if (!symptoms || !result) {
        return { statusCode: 400, body: { ok: false, error: "Symptoms and result are required." } };
    }

    const auth = getAuthenticatedUser(db, request);
    let user = auth ? auth.user : null;

    if (!user) {
        user = upsertUserInDb(db, payload, request);
    }

    user.lastSeenAt = nowIso();
    user.searchesCount += 1;
    user.usageCount += 1;

    const search = {
        id: createId("search"),
        userId: user.id,
        visitorId: user.visitorId,
        email: user.email,
        name: user.name,
        symptoms,
        result,
        timestamp: nowIso(),
        ipAddress: getClientIp(request)
    };

    db.searches.unshift(search);
    db.searches = db.searches.slice(0, 1500);

    recordEvent(db, {
        type: "search_logged",
        userId: user.id,
        email: user.email,
        detail: symptoms
    });

    writeDb(db);

    return {
        statusCode: 201,
        body: {
            ok: true,
            search
        }
    };
}

function getUserSearches(request) {
    const db = readDb();
    const auth = getAuthenticatedUser(db, request);

    if (!auth) {
        return { statusCode: 401, body: { ok: false, error: "Authentication required." } };
    }

    const searches = db.searches.filter(item => item.userId === auth.user.id);
    return {
        statusCode: 200,
        body: {
            ok: true,
            searches
        }
    };
}

function deleteUserSearch(request, pathname) {
    const db = readDb();
    const auth = getAuthenticatedUser(db, request);

    if (!auth) {
        return { statusCode: 401, body: { ok: false, error: "Authentication required." } };
    }

    const prefix = "/api/my/searches/";
    const searchId = pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : "";
    const initialLength = db.searches.length;
    db.searches = db.searches.filter(item => !(item.userId === auth.user.id && item.id === searchId));

    if (db.searches.length === initialLength) {
        return { statusCode: 404, body: { ok: false, error: "Search entry not found." } };
    }

    writeDb(db);
    return { statusCode: 200, body: { ok: true } };
}

function clearUserSearches(request) {
    const db = readDb();
    const auth = getAuthenticatedUser(db, request);

    if (!auth) {
        return { statusCode: 401, body: { ok: false, error: "Authentication required." } };
    }

    db.searches = db.searches.filter(item => item.userId !== auth.user.id);
    writeDb(db);
    return { statusCode: 200, body: { ok: true } };
}

function buildOverview(db) {
    return {
        usersCount: db.users.length,
        searchesCount: db.searches.length,
        otpRequestsCount: db.otpSessions.length,
        profilesCompleteCount: db.users.filter(item => item.profileComplete).length,
        totalUsageCount: db.users.reduce((sum, item) => sum + Number(item.usageCount || 0), 0),
        latestEvent: db.events[0] || null,
        systemStatus: {
            otpProvider: getMailProvider(),
            adminPath: "/admin.html",
            resendConfigured: Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL),
            gmailConfigured: Boolean(GMAIL_EMAIL && GMAIL_APP_PASSWORD),
            geminiConfigured: Boolean(GEMINI_API_KEY),
            infermedicaConfigured: Boolean(INFERMEDICA_APP_ID && INFERMEDICA_APP_KEY),
            googlePlacesConfigured: Boolean(GOOGLE_MAPS_API_KEY)
        }
    };
}

function serveStatic(request, response, pathname) {
    let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.join(ROOT_DIR, relativePath);

    if (!filePath.startsWith(ROOT_DIR)) {
        notFound(response);
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            notFound(response);
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
        });
        response.end(content);
    });
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
        sendJson(response, 200, { ok: true });
        return;
    }

    try {
        if (pathname === "/api/health" && request.method === "GET") {
            sendJson(response, 200, { ok: true, service: "symptoscan-backend", timestamp: nowIso() });
            return;
        }

        if (pathname === "/api/users/identify" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = identifyUser(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/auth/request-otp" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = await requestOtp(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/auth/signup" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = signupUser(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/admin/login" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = loginAdmin(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/auth/login" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = loginUser(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/auth/login-otp" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = loginWithOtp(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/profile" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = updateProfile(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/searches" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = logSearch(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/symptom-check" && request.method === "POST") {
            const payload = await parseBody(request);
            const result = await analyzeSymptoms(payload, request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/my/searches" && request.method === "GET") {
            const result = getUserSearches(request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname === "/api/my/searches" && request.method === "DELETE") {
            const result = clearUserSearches(request);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname.startsWith("/api/my/searches/") && request.method === "DELETE") {
            const result = deleteUserSearch(request, pathname);
            sendJson(response, result.statusCode, result.body);
            return;
        }

        if (pathname.startsWith("/api/admin/")) {
            const db = readDb();
            if (!getAuthenticatedAdmin(db, request)) {
                sendJson(response, 401, { ok: false, error: "Admin authentication required." });
                return;
            }

            if (pathname === "/api/admin/overview" && request.method === "GET") {
                sendJson(response, 200, { ok: true, overview: buildOverview(db) });
                return;
            }

            if (pathname === "/api/admin/users" && request.method === "GET") {
                sendJson(response, 200, { ok: true, users: db.users.map(sanitizeUserForAdmin) });
                return;
            }

            if (pathname === "/api/admin/searches" && request.method === "GET") {
                sendJson(response, 200, { ok: true, searches: db.searches });
                return;
            }

            if (pathname === "/api/admin/events" && request.method === "GET") {
                sendJson(response, 200, { ok: true, events: db.events });
                return;
            }
        }

        serveStatic(request, response, pathname);
    } catch (error) {
        sendJson(response, 500, {
            ok: false,
            error: error.message || "Internal server error"
        });
    }
});

ensureStorage();

server.listen(PORT, () => {
    console.log(`SymptoScan backend running on http://localhost:${PORT}`);
});
