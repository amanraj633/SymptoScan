const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const timestamp = Date.now();
const testEmail = process.env.SMOKE_TEST_EMAIL || `smoketest_${timestamp}@example.com`;
const testPassword = process.env.SMOKE_TEST_PASSWORD || "TestPass123";
const adminEmail = process.env.ADMIN_EMAIL || "admin@symptoscan.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
}

async function run() {
    console.log("Running SymptoScan smoke test against:", BASE_URL);
    console.log("Test email:", testEmail);

    const otpResponse = await requestJson(`${BASE_URL}/api/auth/request-otp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: testEmail,
            visitorId: `smoke_visitor_${timestamp}`
        })
    });

    if (!otpResponse.otp) {
        throw new Error(
            "Smoke test needs demo OTP mode or an OTP exposed in the response. " +
            "If real email sending is enabled, use the frontend flow or temporarily test with demo OTP."
        );
    }

    console.log("OTP requested successfully.");

    const signupResponse = await requestJson(`${BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: testEmail,
            otp: otpResponse.otp,
            password: testPassword,
            visitorId: `smoke_visitor_${timestamp}`
        })
    });

    const token = signupResponse.session && signupResponse.session.token;
    if (!token) {
        throw new Error("Signup did not return a session token.");
    }

    console.log("Signup completed.");

    await requestJson(`${BASE_URL}/api/profile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            name: "Smoke Test User",
            gender: "Other",
            phoneNumber: "+91 9999999999",
            age: "25",
            bloodGroup: "O+",
            location: "Delhi",
            emergencyContact: "9999999998",
            dateOfBirth: "2000-01-01"
        })
    });

    console.log("Profile saved.");

    await requestJson(`${BASE_URL}/api/searches`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            email: testEmail,
            visitorId: `smoke_visitor_${timestamp}`,
            symptoms: "fever, cough",
            result: "Likely condition: Flu or viral fever"
        })
    });

    console.log("Search logged.");

    const adminLoginResponse = await requestJson(`${BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: adminEmail,
            password: adminPassword
        })
    });

    const adminToken = adminLoginResponse.session && adminLoginResponse.session.token;
    if (!adminToken) {
        throw new Error("Admin login did not return a session token.");
    }

    const usersResponse = await requestJson(`${BASE_URL}/api/admin/users`, {
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });
    const searchesResponse = await requestJson(`${BASE_URL}/api/admin/searches`, {
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });

    const userFound = usersResponse.users.some(user => user.email === testEmail && user.name === "Smoke Test User");
    const searchFound = searchesResponse.searches.some(search => search.email === testEmail && search.symptoms === "fever, cough");

    if (!userFound) {
        throw new Error("Admin users endpoint did not include the test user.");
    }

    if (!searchFound) {
        throw new Error("Admin searches endpoint did not include the test search.");
    }

    console.log("Admin checks passed.");
    console.log("Smoke test completed successfully.");
}

run().catch(error => {
    console.error("Smoke test failed:", error.message);
    process.exit(1);
});
