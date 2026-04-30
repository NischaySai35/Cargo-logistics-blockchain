// ─────────────────────────────────────────────────────────────────────────────
// DLN-Lite Backend Server
// Entry point — sets up Express, middleware, routes
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { connectDB } = require("./utils/db");
const logger = require("./utils/logger");

const shipmentRoutes = require("./routes/shipmentRoutes");
const mlRoutes = require("./routes/mlRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Connect to MongoDB (off-chain bulk data)
// ─────────────────────────────────────────────────────────────────────────────
connectDB();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "null",
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting — prevent API abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 200 : 5000,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    service: "Cargo Intel API",
    status: "ok",
    docs: {
      health: "/api/health",
      shipments: "/api/shipments",
      analytics: "/api/analytics/summary",
    },
  });
});

app.use("/api/shipments", shipmentRoutes);  // Blockchain + DB shipment operations
app.use("/api/ml", mlRoutes);               // ML predictions
app.use("/api/analytics", analyticsRoutes); // Dashboard analytics
app.use("/api/health", healthRoutes);       // System health check
app.use("/api/auth", authRoutes);           // Account sign-up / sign-in
app.use("/api/chat", chatRoutes);           // Grok chatbot proxy

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ DLN-Lite API running on http://localhost:${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app; // for tests
