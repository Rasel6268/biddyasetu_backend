const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://biddyasetu.org",
  "https://www.biddyasetu.org",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman) or matched origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

// Body Parsers & Cookie Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Health Check Routes
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Biddyasetu Backend API is running successfully",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", require("./routes/auth.route"));
app.use("/api/members", require("./routes/member.route"));
app.use("/api/users", require("./routes/member.route"));
app.use("/api/events", require("./routes/event.route"));
app.use("/api/announcements", require("./routes/announcement.route"));
app.use("/api/ssl", require("./routes/payment.route"));
app.use("/api/payment", require("./routes/payment.route"));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`,
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error("Backend Error:", err);

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const message = `An account with that ${field} already exists.`;
    return res.status(400).json({
      success: false,
      message,
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0] || "Validation error occurred.",
      errors: messages,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please authenticate again.",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please log in again.",
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected internal server error occurred.";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

module.exports = app;