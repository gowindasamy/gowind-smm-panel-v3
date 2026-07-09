const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const SALT_ROUNDS = 10;

// ===========================================
// PostgreSQL Connection
// ===========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ===========================================
// Database Initialization
// ===========================================

async function initializeDatabase() {

  const client = await pool.connect();

  try {

    await client.query(`

CREATE TABLE IF NOT EXISTS users (

id SERIAL PRIMARY KEY,

username VARCHAR(50) UNIQUE NOT NULL,

password TEXT NOT NULL,

balance NUMERIC(12,4) DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS api_providers (

id SERIAL PRIMARY KEY,

provider_name VARCHAR(150) NOT NULL,

api_url TEXT NOT NULL,

api_key TEXT NOT NULL,

status VARCHAR(20) DEFAULT 'enabled',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS services (

id SERIAL PRIMARY KEY,

provider_id INTEGER REFERENCES api_providers(id) ON DELETE CASCADE,

service_name VARCHAR(255) NOT NULL,

service_id VARCHAR(50) NOT NULL,

price NUMERIC(12,4) NOT NULL,

min_quantity INTEGER NOT NULL,

max_quantity INTEGER NOT NULL,

status VARCHAR(20) DEFAULT 'enabled',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS orders (

id SERIAL PRIMARY KEY,

user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

provider_id INTEGER REFERENCES api_providers(id),

service_id VARCHAR(50) NOT NULL,

order_id VARCHAR(120),

service_name VARCHAR(255) NOT NULL,

link TEXT NOT NULL,

quantity INTEGER NOT NULL,

price NUMERIC(12,4) NOT NULL,

status VARCHAR(30) DEFAULT 'Processing',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS admin_settings (

id SERIAL PRIMARY KEY,

admin_password TEXT NOT NULL,

settings_password TEXT NOT NULL

);

`);

    const settings = await client.query(
      "SELECT * FROM admin_settings LIMIT 1"
    );

    if (settings.rows.length === 0) {

      const adminHash = await bcrypt.hash(
        "admin123",
        SALT_ROUNDS
      );

      const settingsHash = await bcrypt.hash(
        "settings123",
        SALT_ROUNDS
      );

      await client.query(

        `INSERT INTO admin_settings
        (admin_password,settings_password)
        VALUES($1,$2)`,

        [adminHash, settingsHash]

      );

      console.log("Default admin credentials created.");

    }

    console.log("Database initialized successfully.");

  }

  catch (err) {

    console.error(err);

  }

  finally {

    client.release();

  }

}

initializeDatabase();

// ===========================================
// Health Check
// ===========================================

app.get("/", (req, res) => {

  res.json({

    project: "GOWIND SMM PANEL V3",

    version: "3.0.0 Stable",

    backend: "Running",

    database: "Render PostgreSQL"

  });

});

// ===========================================
// API Status
// ===========================================

app.get("/api/admin/system/status", async (req, res) => {

  try {

    await pool.query("SELECT 1");

    res.json({

      backend: "Connected",

      database: "Connected",

      apiGateway: "Connected"

    });

  }

  catch {

    res.json({

      backend: "Offline",

      database: "Offline",

      apiGateway: "Offline"

    });

  }

});
// ===========================================
// USER LOGIN
// ===========================================

app.post("/api/auth/login", async (req, res) => {

  const { username, password } = req.body;

  try {

    const result = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      balance: user.balance
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// ===========================================
// ADMIN LOGIN
// ===========================================

app.post("/api/auth/admin", async (req, res) => {

  const { password } = req.body;

  try {

    const result = await pool.query(
      "SELECT * FROM admin_settings LIMIT 1"
    );

    const admin = result.rows[0];

    const match = await bcrypt.compare(
      password,
      admin.admin_password
    );

    if (!match) {

      return res.status(401).json({
        error: "Access Denied"
      });

    }

    res.json({
      isAdmin: true
    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// ===========================================
// USER PROFILE
// ===========================================

app.get("/api/user/:id", async (req, res) => {

  try {

    const result = await pool.query(

      `SELECT
      id,
      username,
      balance
      FROM users
      WHERE id=$1`,

      [req.params.id]

    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "User not found"
      });

    }

    res.json(result.rows[0]);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// ===========================================
// ACTIVE SERVICES
// ===========================================

app.get("/api/services/active", async (req, res) => {

  try {

    const result = await pool.query(

`
SELECT

s.id,

s.service_name,

s.service_id,

s.price,

s.min_quantity,

s.max_quantity,

p.provider_name

FROM services s

INNER JOIN api_providers p

ON s.provider_id=p.id

WHERE

s.status='enabled'

AND

p.status='enabled'

ORDER BY s.id ASC

`

    );

    res.json(result.rows);

  }

  catch (err) {

    res.status(500).json({

      error: err.message

    });

  }

});
// ===========================================
// CREATE NEW ORDER
// ===========================================

app.post("/api/orders/new", async (req, res) => {

  const { userId, serviceId, link, quantity } = req.body;

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    // Lock User
    const userResult = await client.query(
      "SELECT * FROM users WHERE id=$1 FOR UPDATE",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];

    // Service
    const serviceResult = await client.query(
      "SELECT * FROM services WHERE id=$1",
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error("Service not found");
    }

    const service = serviceResult.rows[0];

    // Quantity Validation
    if (quantity < service.min_quantity) {
      throw new Error(
        `Minimum Quantity is ${service.min_quantity}`
      );
    }

    if (quantity > service.max_quantity) {
      throw new Error(
        `Maximum Quantity is ${service.max_quantity}`
      );
    }

    // Price
    const totalPrice =
      (Number(service.price) / 1000) *
      Number(quantity);

    if (Number(user.balance) < totalPrice) {
      throw new Error("Insufficient Balance");
    }

    // Provider
    const providerResult = await client.query(
      "SELECT * FROM api_providers WHERE id=$1",
      [service.provider_id]
    );

    if (providerResult.rows.length === 0) {
      throw new Error("Provider not found");
    }

    const provider = providerResult.rows[0];

    let apiOrderId = null;

    // =====================================
    // REAL PROVIDER API
    // =====================================

    try {

      /*
      Production Example

      const response = await fetch(provider.api_url,{
        method:"POST",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded"
        },
        body:new URLSearchParams({
          key:provider.api_key,
          action:"add",
          service:service.service_id,
          link,
          quantity
        })
      });

      const data=await response.json();

      apiOrderId=data.order;
      */

      // Temporary Development ID
      apiOrderId =
        "DEV" +
        Date.now() +
        Math.floor(Math.random() * 1000);

    } catch {

      apiOrderId =
        "FAILED-" + Date.now();

    }

    // Deduct Balance
    await client.query(

      `UPDATE users
       SET balance=balance-$1
       WHERE id=$2`,

      [totalPrice, userId]

    );

    // Insert Order
    const orderInsert = await client.query(

`
INSERT INTO orders(

user_id,

provider_id,

service_id,

order_id,

service_name,

link,

quantity,

price,

status

)

VALUES(

$1,$2,$3,$4,$5,$6,$7,$8,$9

)

RETURNING *

`,

[
userId,
service.provider_id,
service.service_id,
apiOrderId,
service.service_name,
link,
quantity,
totalPrice,
"Processing"
]

    );

    await client.query("COMMIT");

    res.json(orderInsert.rows[0]);

  }

  catch(err){

    await client.query("ROLLBACK");

    res.status(500).json({
      error:err.message
    });

  }

  finally{

    client.release();

  }

});

// ===========================================
// USER ORDER HISTORY
// ===========================================

app.get("/api/orders/user/:id", async (req,res)=>{

  try{

    const result=await pool.query(

`
SELECT

order_id,

created_at,

status,

service_name,

link,

quantity,

price

FROM orders

WHERE user_id=$1

ORDER BY id DESC

`,

[req.params.id]

    );

    res.json(result.rows);

  }

  catch(err){

    res.status(500).json({
      error:err.message
    });

  }

});
// ===========================================
// ADMIN DASHBOARD METRICS
// ===========================================

app.get("/api/admin/metrics", async (req, res) => {

  try {

    const users = await pool.query(
      "SELECT COUNT(*) AS total_users, COALESCE(SUM(balance),0) AS total_balance FROM users"
    );

    const orders = await pool.query(
      "SELECT COUNT(*) AS total_orders FROM orders"
    );

    const services = await pool.query(
      "SELECT COUNT(*) AS total_services FROM services"
    );

    const providers = await pool.query(
      "SELECT COUNT(*) AS total_providers FROM api_providers"
    );

    res.json({

      totalUsers: Number(users.rows[0].total_users),

      totalBalance: Number(users.rows[0].total_balance),

      totalOrders: Number(orders.rows[0].total_orders),

      totalServices: Number(services.rows[0].total_services),

      totalProviders: Number(providers.rows[0].total_providers)

    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// ===========================================
// USER MANAGEMENT
// ===========================================

// Get Users

app.get("/api/admin/users", async (req, res) => {

  try {

    const result = await pool.query(

      `SELECT
      id,
      username,
      balance
      FROM users
      ORDER BY id DESC`

    );

    res.json(result.rows);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// Add User

app.post("/api/admin/users/add", async (req, res) => {

  const {

    username,

    password,

    balance

  } = req.body;

  try {

    const hash = await bcrypt.hash(
      password,
      SALT_ROUNDS
    );

    await pool.query(

      `INSERT INTO users
      (
      username,
      password,
      balance
      )
      VALUES($1,$2,$3)`,

      [

        username,

        hash,

        balance

      ]

    );

    res.json({

      success: true

    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// Edit User

app.post("/api/admin/users/edit", async (req, res) => {

  const {

    id,

    password,

    balance

  } = req.body;

  try {

    if (password && password.trim() !== "") {

      const hash = await bcrypt.hash(

        password,

        SALT_ROUNDS

      );

      await pool.query(

        `UPDATE users
        SET
        password=$1,
        balance=$2,
        updated_at=NOW()
        WHERE id=$3`,

        [

          hash,

          balance,

          id

        ]

      );

    } else {

      await pool.query(

        `UPDATE users
        SET
        balance=$1,
        updated_at=NOW()
        WHERE id=$2`,

        [

          balance,

          id

        ]

      );

    }

    res.json({

      success: true

    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// Delete User

app.delete("/api/admin/users/:id", async (req, res) => {

  try {

    await pool.query(

      "DELETE FROM users WHERE id=$1",

      [

        req.params.id

      ]

    );

    res.json({

      success: true

    });

  }

  catch (err) {

    res.status(500).json({

      error: err.message

    });

  }

});
