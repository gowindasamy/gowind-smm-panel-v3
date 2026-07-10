const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/order", (req, res) => {
    res.sendFile(path.join(__dirname, "order.html"));
});

app.get("/orderhistory", (req, res) => {
    res.sendFile(path.join(__dirname, "orderhistory.html"));
});

app.get("/service", (req, res) => {
    res.sendFile(path.join(__dirname, "service.html"));
});

app.get("/api", (req, res) => {
    res.sendFile(path.join(__dirname, "api.html"));
});

app.get("/user", (req, res) => {
    res.sendFile(path.join(__dirname, "user.html"));
});

app.get("/usermanagement", (req, res) => {
    res.sendFile(path.join(__dirname, "usermanagement.html"));
});

app.get("/settings", (req, res) => {
    res.sendFile(path.join(__dirname, "settings.html"));
});

// Health Check
app.get("/health", (req, res) => {
    res.json({
        status: "online",
        version: "V3.0.1",
        project: "Gowind SMM Panel"
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
