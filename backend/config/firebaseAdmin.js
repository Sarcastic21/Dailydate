const fs = require("fs");
const path = require("path");

let initAttempted = false;
let adminResult = null;

/**
 * Firebase Admin for FCM. Place service account JSON at:
 *   backend/config/firebase-service-account.json
 * or FIREBASE_SERVICE_ACCOUNT_PATH=/path/to.json
 */
function getAdmin() {
    if (initAttempted) {
        return adminResult;
    }
    initAttempted = true;

    const keyPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        path.join(__dirname, "firebase-service-account.json");

    if (!fs.existsSync(keyPath)) {
        console.warn("[FCM] No service account at", keyPath, "— push disabled");
        adminResult = null;
        return null;
    }

    try {
        const admin = require("firebase-admin");
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
        adminResult = admin;
        console.log("[FCM] Firebase Admin initialized");
        return admin;
    } catch (err) {
        console.error("[FCM] Firebase Admin init failed:", err.message);
        adminResult = null;
        return null;
    }
}

module.exports = { getAdmin };
