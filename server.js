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
      await db.query(`
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet DECIMAL(10,2) DEFAULT 0;
`);
    await db.query(`
CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    provider_id INT,
    service_id INT,
    name VARCHAR(255),
    category VARCHAR(100),
    rate DECIMAL(10,2),
    min INT,
    max INT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT,
    service_id INT,
    link TEXT,
    quantity INT,
    charge DECIMAL(10,2),
    status VARCHAR(30) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INT,
    amount DECIMAL(10,2),
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    site_name VARCHAR(100),
    currency VARCHAR(10),
    maintenance BOOLEAN DEFAULT FALSE
);
`);
    res.json({
      success: true,
      message: "All database tables created successfully."
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
// Add Service
app.post("/api/services", async (req, res) => {
    try {

        const {
            service_id,
            name,
            category,
            rate,
            min,
            max
        } = req.body;

        await db.query(
            `INSERT INTO services
            (service_id, name, category, rate, min, max)
            VALUES ($1,$2,$3,$4,$5,$6)`,
            [
                service_id,
                name,
                category,
                rate,
                min,
                max
            ]
        );

        res.json({
            success: true,
            message: "Service Added Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
// Get All Services API
app.get("/api/services", async (req, res) => {
    try {

        const result = await db.query(
            "SELECT * FROM services WHERE status = TRUE ORDER BY id ASC"
        );

        res.json({
            success: true,
            total: result.rows.length,
            services: result.rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
// Place Order API
app.post("/api/orders", async (req, res) => {
    try {

        const {
            user_id,
            service_id,
            link,
            quantity
        } = req.body;

        // Service details
        const service = await db.query(
            "SELECT * FROM services WHERE id = $1",
            [service_id]
        );

        if (service.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        const price =
            (Number(service.rows[0].rate) * Number(quantity)) / 1000;

        await db.query(
            `INSERT INTO orders
            (user_id, service_id, link, quantity, charge, status)
            VALUES ($1,$2,$3,$4,$5,$6)`,
            [
                user_id,
                service_id,
                link,
                quantity,
                price,
                "Pending"
            ]
        );

        res.json({
            success: true,
            message: "Order Placed Successfully",
            charge: price
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
// Get Orders API
app.get("/api/orders", async (req, res) => {
    try {

        const result = await db.query(
            "SELECT * FROM orders ORDER BY id DESC"
        );

        res.json({
            success: true,
            total: result.rows.length,
            orders: result.rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});
// Wallet Balance API
app.get("/api/wallet/:userId", async (req, res) => {
    try {

        const userId = req.params.userId;

        const result = await db.query(
            "SELECT wallet FROM users WHERE id = $1",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            wallet: result.rows[0].wallet
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
