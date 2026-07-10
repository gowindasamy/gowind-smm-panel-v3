require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./db");
const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

// Home
app.get("/", (req, res) => {
    res.json({
        success: true,
        name: "Gowind SMM Panel",
        version: "3.0.1",
        status: "Online"
    });
});

// Health Check
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        uptime: process.uptime()
    });
});

// Login API (Placeholder)
app.post("/api/login", (req, res) => {
    res.json({
        success: true,
        message: "Login API Ready"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
