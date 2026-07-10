require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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

// Database Test
app.get("/db-test", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");

        res.json({
            success: true,
            database: "Connected",
            time: result.rows[0]
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
app.get("/setup", async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        status BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.json({
      success: true,
      message: "Users table created successfully."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
// Login API
app.post("/api/login", async (req, res) => {
    try {

        const { username, password } = req.body;

        const result = await db.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid Username"
            });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            message: "Login Successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
// Register API
app.post("/api/register", async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Check if user already exists
        const checkUser = await db.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Username already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await db.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
            [
                username,
                hashedPassword,
                role || "user"
            ]
        );

        res.json({
            success: true,
            message: "User registered successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
