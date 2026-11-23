require("dotenv").config();
const path = require("path");
const express = require("express");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");
const notificationRoutes = require("./routes/notificationRoutes");
const morgan = require("morgan");
const passport = require("passport");
require("./config/passport");
connectDB();
const app = express();



// --- FCM Setup ---
const admin = require("firebase-admin");
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ FCM initialized successfully");
} catch (err) {
  console.error("❌ FCM initialization failed:", err);
}
// Utility function to send FCM message
app.locals.sendFcmMessage = async ({ token, notification, data }) => {
  const message = {
    token,
    notification,
    data,
  };
  return admin.messaging().send(message);
};
// --- End FCM Setup ---

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(passport.initialize());
app.get("/api", (req, res) => {
  res.send("Welcome to the PIMS API");
});

// Logging middleware
app.use(morgan("dev"));

// API
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/leave", require("./routes/leaveRoutes"));
app.use("/api/parent", require("./routes/parentRoutes"));
app.use("/api/warden", require("./routes/wardenRoutes"));
app.use("/api/guard", require("./routes/guardRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/v1/admin", require("./routes/adminUserRoutes"));
app.use("/api/notifications", notificationRoutes);
app.use("/api/drive", require("./routes/driveRoutes"));
app.use("/api/whatsapp-check", require("./routes/whatsappCheckRoutes"));

// Serve React in production
if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "client/build");
  app.use(express.static(clientPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).end();
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

// Remove or protect in production!
app.post("/api/test-fcm", async (req, res) => {
  try {
    const { token, notification, data } = req.body;
    const response = await app.locals.sendFcmMessage({
      token,
      notification,
      data,
    });
    res.json({ success: true, response });
  } catch (err) {
    console.error("FCM send error:", err); // Add this line for better debugging
    res
      .status(500)
      .json({ success: false, error: err.message, details: err.stack });
  }
});


// ---------- start: lightweight background pinger (non-blocking) ----------
/**
 * Pinger:
 * - hits PINGER_URL every PINGER_INTERVAL_MS milliseconds
 * - logs basic info (timestamp, status, response length or error)
 * - won't crash the app if fetch is missing / fails
 * - can be disabled via env PINGER_ENABLED=false
 * - configurable via env: PINGER_URL, PINGER_INTERVAL_MS, PINGER_TIMEOUT_MS
 *
 * Recommended env (example):
 *   PINGER_ENABLED=true
 *   PINGER_URL=https://college-leave-backend.onrender.com
 *   PINGER_INTERVAL_MS=30000
 *   PINGER_TIMEOUT_MS=10000
 */

(async () => {
  try {
    const PINGER_ENABLED = (process.env.PINGER_ENABLED ?? "true").toLowerCase() !== "false";
    if (!PINGER_ENABLED) {
      console.log("[pinger] disabled via PINGER_ENABLED=false");
      return;
    }

    // Config
    const PINGER_URL =  "https://college-leave-backend.onrender.com/";
    const PINGER_INTERVAL_MS = Number(process.env.PINGER_INTERVAL_MS) || 30_000;
    const PINGER_TIMEOUT_MS = Number(process.env.PINGER_TIMEOUT_MS) || 10_000;

    // Resolve fetch (use global if available, otherwise try node-fetch)
    let fetchFn = globalThis.fetch;
    if (!fetchFn) {
      try {
        // dynamic import — only if needed
        const nodeFetch = await import("node-fetch");
        fetchFn = nodeFetch.default;
        console.log("[pinger] using node-fetch (dynamically imported)");
      } catch (err) {
        console.warn("[pinger] fetch unavailable and node-fetch not installed — pinger disabled");
        return;
      }
    }

    // Create abortable pinger function with timeout
    const pingOnce = async () => {
      const ts = new Date().toISOString();
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, PINGER_TIMEOUT_MS);

      try {
        const resp = await fetchFn(PINGER_URL, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "Copy Checker/1.0 (+https://your-app)",
            Accept: "text/plain, application/json, */*",
          },
        });

        // try to get small part of body safely (avoid huge body reads)
        let bodyPreview = "";
        try {
          const text = await resp.text();
          bodyPreview = text.length > 200 ? text.slice(0, 200) + "..." : text;
        } catch (e) {
          bodyPreview = "<unreadable body>";
        }

        console.log(`[pinger] ${ts} ${PINGER_URL} -> ${resp.status} ${resp.statusText} (len=${bodyPreview.length})`);
      } catch (err) {
        if (err && err.name === "AbortError") {
          console.warn(`[pinger] ${ts} ${PINGER_URL} -> timeout after ${PINGER_TIMEOUT_MS}ms`);
        } else {
          console.error(`[pinger] ${ts} ${PINGER_URL} -> error:`, err && (err.message || err));
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    // Run immediately, then schedule
    await pingOnce().catch((e) => console.error("[pinger] initial ping failed:", e));
    const intervalId = setInterval(() => {
      // run and swallow unhandled rejections
      pingOnce().catch((e) => console.error("[pinger] ping failed:", e));
    }, PINGER_INTERVAL_MS);

    // graceful shutdown: clear interval and abort any pending operation
    const shutdown = (signal) => {
      console.log(`[pinger] shutting down (${signal}), clearing interval`);
      clearInterval(intervalId);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("exit", () => shutdown("exit"));

    console.log(`[pinger] started: ${PINGER_URL} every ${PINGER_INTERVAL_MS}ms (timeout ${PINGER_TIMEOUT_MS}ms)`);
  } catch (outerErr) {
    console.error("[pinger] failed to start:", outerErr);
  }
})();
// ---------- end: pinger ----------




app.use(errorHandler);
module.exports = app;
