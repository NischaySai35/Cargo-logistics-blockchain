// utils/db.js — MongoDB connection
const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/dlnlite");
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    global.__DLN_MEMORY_DB__ = true;
    logger.warn(`MongoDB unavailable, falling back to in-memory metadata store: ${error.message}`);
  }
};

module.exports = connectDB;
