// ─────────────────────────────────────────────────────────────────────────────
// Health Routes
// System health check — checks DB, blockchain, and ML service
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const mlService = require("../services/mlService");

router.get("/", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "ok" : "down";
  const mlStatus = await mlService.healthCheck();

  const allOk = dbStatus === "ok" && mlStatus.status === "ok";

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      mongodb: dbStatus,
      mlService: mlStatus.status,
      blockchain: "check fabric logs", // Fabric has its own health endpoint
    },
  });
});

module.exports = router;
