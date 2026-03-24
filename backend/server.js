const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = process.env.PORT || 3000;

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

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            users: [],
            searches: [],
            otpSessions: [],
            events: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    }
}

function readDb() {
    ensureStorage();
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
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

function createId(prefix) {
    return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function nowIso() {
    return new Date().toISOString();
}

function getClientIp(request) {
    return request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown";
}

function upsertUser(payload, request) {
    const db = readDb();
    const email = (payload.email || "").trim().toLowerCase();
    const visitorId = (payload.visitorId || "").trim() || createId("visitor");

    let user = db.users.find(item => item.email === email || item.visitorId === visitorId);
    if (!user) {
        user = {
            id: createId("user"),
            visitorId,
            email: email || null,
            name: payload.name || null,
            location: payload.location || null,
            createdAt: nowIso(),
            lastSeenAt: nowIso(),
            searchesCount: 0,
            ipAddress: getClientIp(request)
        };
        db.users.push(user);
    } else {
        user.email = email || user.email;
        user.name = payload.name || user.name;
        user.location = payload.location || user.location;
        user.lastSeenAt = nowIso();
        user.ipAddress = getClientIp(request);
    }

    db.events.unshift({
        id: createId("event"),
        type: "user_identified",
        userId: user.id,
        email: user.email,
        timestamp: nowIso(),
        detail: "User identified on frontend"
    });
    db.events = db.events.slice(0, 300);
    writeDb(db);
    return user;
}

function logSearch(payload, request) {
    const db = readDb();
    const symptoms = (payload.symptoms || "").trim();
    const result = (payload.result || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    const visitorId = (payload.visitorId || "").trim();

    let user = db.users.find(item => item.email === email || (visitorId && item.visitorId === visitorId));
    if (!user) {
        user = upsertUser({ email, visitorId }, request);
    }

    const search = {
        id: createId("search"),
        userId: user.id,
        visitorId: user.visitorId,
        email: user.email,
        symptoms,
        result,
        timestamp: nowIso(),
        ipAddress: getClientIp(request)
    };

    db.searches.unshift(search);
    db.searches = db.searches.slice(0, 1000);

    const matchedUser = db.users.find(item => item.id === user.id);
    if (matchedUser) {
        matchedUser.searchesCount += 1;
        matchedUser.lastSeenAt = nowIso();
    }

    db.events.unshift({
        id: createId("event"),
        type: "search_logged",
        userId: user.id,
        email: user.email,
        timestamp: nowIso(),
        detail: symptoms
    });
    db.events = db.events.slice(0, 300);
    writeDb(db);
    return search;
}

function requestOtp(payload, request) {
    const db = readDb();
    const email = (payload.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
        return { error: "Valid email is required." };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpSession = {
        id: createId("otp"),
        email,
        otp,
        verified: false,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        ipAddress: getClientIp(request)
    };

    db.otpSessions.unshift(otpSession);
    db.otpSessions = db.otpSessions.slice(0, 200);
    db.events.unshift({
        id: createId("event"),
        type: "otp_requested",
        userId: null,
        email,
        timestamp: nowIso(),
        detail: "Demo OTP generated"
    });
    db.events = db.events.slice(0, 300);
    writeDb(db);
    return otpSession;
}

function verifyOtp(payload) {
    const db = readDb();
    const email = (payload.email || "").trim().toLowerCase();
    const otp = (payload.otp || "").trim();

    const session = db.otpSessions.find(item => item.email === email && item.otp === otp && !item.verified);
    if (!session) {
        return { error: "Invalid OTP." };
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
        return { error: "OTP expired." };
    }

    session.verified = true;
    db.events.unshift({
        id: createId("event"),
        type: "otp_verified",
        userId: null,
        email,
        timestamp: nowIso(),
        detail: "Demo OTP verified"
    });
    db.events = db.events.slice(0, 300);
    writeDb(db);

    return { verified: true, email };
}

function buildOverview(db) {
    return {
        usersCount: db.users.length,
        searchesCount: db.searches.length,
        otpRequestsCount: db.otpSessions.length,
        latestUser: db.users[0] || null,
        latestSearch: db.searches[0] || null,
        latestEvent: db.events[0] || null
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
            const user = upsertUser(payload, request);
            sendJson(response, 200, { ok: true, user });
            return;
        }

        if (pathname === "/api/auth/request-otp" && request.method === "POST") {
            const payload = await parseBody(request);
            const otpSession = requestOtp(payload, request);
            if (otpSession.error) {
                sendJson(response, 400, { ok: false, error: otpSession.error });
                return;
            }

            sendJson(response, 200, {
                ok: true,
                otp: otpSession.otp,
                expiresAt: otpSession.expiresAt,
                note: "Demo OTP is returned directly because email delivery is not configured yet."
            });
            return;
        }

        if (pathname === "/api/auth/verify-otp" && request.method === "POST") {
            const payload = await parseBody(request);
            const verification = verifyOtp(payload);
            if (verification.error) {
                sendJson(response, 400, { ok: false, error: verification.error });
                return;
            }

            sendJson(response, 200, { ok: true, verification });
            return;
        }

        if (pathname === "/api/searches" && request.method === "POST") {
            const payload = await parseBody(request);
            const search = logSearch(payload, request);
            sendJson(response, 201, { ok: true, search });
            return;
        }

        if (pathname === "/api/admin/overview" && request.method === "GET") {
            const db = readDb();
            sendJson(response, 200, { ok: true, overview: buildOverview(db) });
            return;
        }

        if (pathname === "/api/admin/users" && request.method === "GET") {
            const db = readDb();
            sendJson(response, 200, { ok: true, users: db.users });
            return;
        }

        if (pathname === "/api/admin/searches" && request.method === "GET") {
            const db = readDb();
            sendJson(response, 200, { ok: true, searches: db.searches });
            return;
        }

        if (pathname === "/api/admin/events" && request.method === "GET") {
            const db = readDb();
            sendJson(response, 200, { ok: true, events: db.events });
            return;
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
