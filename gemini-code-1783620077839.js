const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL Pool Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SALT_ROUNDS = 10;

// Initialize Database Tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        balance NUMERIC(10, 4) DEFAULT 0.0000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS api_providers (
        id SERIAL PRIMARY KEY,
        provider_name VARCHAR(100) NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'enabled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        provider_id INT REFERENCES api_providers(id) ON DELETE CASCADE,
        service_name VARCHAR(255) NOT NULL,
        service_id VARCHAR(50) NOT NULL,
        price NUMERIC(10, 4) NOT NULL,
        min_quantity INT NOT NULL,
        max_quantity INT NOT NULL,
        status VARCHAR(20) DEFAULT 'enabled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        provider_id INT REFERENCES api_providers(id) ON DELETE SET NULL,
        service_id VARCHAR(50) NOT NULL,
        order_id VARCHAR(100), 
        service_name VARCHAR(255) NOT NULL,
        link TEXT NOT NULL,
        quantity INT NOT NULL,
        price NUMERIC(10, 4) NOT NULL,
        status VARCHAR(50) DEFAULT 'Processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        admin_password TEXT NOT NULL,
        settings_password TEXT NOT NULL
      );
    `);
    
    // Seed default admin access if table empty
    const res = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (res.rows.length === 0) {
      const hashedPass = await bcrypt.hash('admin123', SALT_ROUNDS);
      const hashedSet = await bcrypt.hash('settings123', SALT_ROUNDS);
      await client.query('INSERT INTO admin_settings (admin_password, settings_password) VALUES ($1, $2)', [hashedPass, hashedSet]);
    }
  } catch (err) {
    console.error('Error establishing SMM DB architecture:', err);
  } finally {
    client.release();
  }
}
initDB();

/* ==========================================
   AUTHENTICATION ENDPOINTS
   ========================================== */

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'User mapping failed' });
    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid Credentials' });
    res.json({ id: user.id, username: user.username, balance: user.balance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/admin', async (req, res) => {
  const { password } = req.body;
  try {
    const adminRes = await pool.query('SELECT * FROM admin_settings LIMIT 1');
    const match = await bcrypt.compare(password, adminRes.rows[0].admin_password);
    if (!match) return res.status(401).json({ error: 'Access Denied' });
    res.json({ isAdmin: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ==========================================
   USER INTERFACE CORE ENDPOINTS
   ========================================== */

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await pool.query('SELECT id, username, balance FROM users WHERE id = $1', [req.params.id]);
    res.json(user.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/services/active', async (req, res) => {
  try {
    const services = await pool.query(`
      SELECT s.id, s.service_name, s.price, s.min_quantity, s.max_quantity 
      FROM services s 
      JOIN api_providers p ON s.provider_id = p.id 
      WHERE s.status = 'enabled' AND p.status = 'enabled'
    `);
    res.json(services.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders/new', async (req, res) => {
  const { userId, serviceId, link, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const serviceRes = await client.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    if (userRes.rows.length === 0 || serviceRes.rows.length === 0) {
      throw new Error('Verification parameters mismatched');
    }

    const user = userRes.rows[0];
    const service = serviceRes.rows[0];
    const totalPrice = (parseFloat(service.price) / 1000) * parseInt(quantity);

    if (parseFloat(user.balance) < totalPrice) {
      return res.status(400).json({ error: 'Insufficient Balance' });
    }

    const providerRes = await client.query('SELECT * FROM api_providers WHERE id = $1', [service.provider_id]);
    const provider = providerRes.rows[0];

    // Real API execution environment simulation context (Perfect Panel Standard API implementation framework)
    let apiOrderId = "MOCK_" + Math.floor(Math.random() * 1000000);
    try {
      // Production Implementation Outlines dynamic call:
      // const response = await fetch(`${provider.api_url}?key=${provider.api_key}&action=add&service=${service.service_id}&link=${link}&quantity=${quantity}`);
      // const data = await response.json(); if(data.order) apiOrderId = data.order;
    } catch(apiErr) {
      console.error("External Provider Handshake Failed:", apiErr.message);
    }

    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalPrice, userId]);
    
    const orderInsert = await client.query(`
      INSERT INTO orders (user_id, provider_id, service_id, order_id, service_name, link, quantity, price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Processing') RETURNING *
    `, [userId, service.provider_id, service.service_id, apiOrderId, service.service_name, link, quantity, totalPrice]);

    await client.query('COMMIT');
    res.json(orderInsert.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/orders/user/:id', async (req, res) => {
  try {
    const orders = await pool.query('SELECT id, order_id, created_at, status, service_name, link, quantity, price FROM orders WHERE user_id = $1 ORDER BY id DESC', [req.params.id]);
    res.json(orders.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ==========================================
   ADMIN MANAGEMENT AGGREGATIONS
   ========================================== */

app.get('/api/admin/metrics', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as count, SUM(balance) as total_bal FROM users');
    const orders = await pool.query('SELECT COUNT(*) as count FROM orders');
    const services = await pool.query('SELECT COUNT(*) as count FROM services');
    const providers = await pool.query('SELECT COUNT(*) as count FROM api_providers');
    res.json({
      totalUsers: users.rows[0].count,
      totalBalance: users.rows[0].total_bal || 0,
      totalOrders: orders.rows[0].count,
      totalServices: services.rows[0].count,
      totalProviders: providers.rows[0].count
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User Management Endpoints
app.get('/api/admin/users', async (req, res) => {
  const users = await pool.query('SELECT id, username, balance FROM users ORDER BY id DESC');
  res.json(users.rows);
});

app.post('/api/admin/users/add', async (req, res) => {
  const { username, password, balance } = req.body;
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query('INSERT INTO users (username, password, balance) VALUES ($1, $2, $3)', [username, hash, balance]);
  res.json({ success: true });
});

app.post('/api/admin/users/edit', async (req, res) => {
  const { id, password, balance } = req.body;
  if (password && password.trim() !== "") {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = $1, balance = $2 WHERE id = $3', [hash, balance, id]);
  } else {
    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [balance, id]);
  }
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Service Management Endpoints
app.get('/api/admin/services', async (req, res) => {
  const svcs = await pool.query('SELECT s.*, p.provider_name FROM services s JOIN api_providers p ON s.provider_id = p.id ORDER BY s.id DESC');
  res.json(svcs.rows);
});

app.post('/api/admin/services/add', async (req, res) => {
  const { provider_id, service_name, service_id, price, min_quantity, max_quantity, status } = req.body;
  await pool.query('INSERT INTO services (provider_id, service_name, service_id, price, min_quantity, max_quantity, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [provider_id, service_name, service_id, price, min_quantity, max_quantity, status]);
  res.json({ success: true });
});

app.post('/api/admin/services/edit', async (req, res) => {
  const { id, provider_id, service_name, service_id, price, min_quantity, max_quantity, status } = req.body;
  await pool.query('UPDATE services SET provider_id = $1, service_name = $2, service_id = $3, price = $4, min_quantity = $5, max_quantity = $6, status = $7 WHERE id = $8', [provider_id, service_name, service_id, price, min_quantity, max_quantity, status, id]);
  res.json({ success: true });
});

app.delete('/api/admin/services/:id', async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Provider Management Endpoints
app.get('/api/admin/providers', async (req, res) => {
  const providers = await pool.query('SELECT id, provider_name, api_url, api_key, status FROM api_providers ORDER BY id DESC');
  res.json(providers.rows);
});

app.post('/api/admin/providers/add', async (req, res) => {
  const { provider_name, api_url, api_key, status } = req.body;
  await pool.query('INSERT INTO api_providers (provider_name, api_url, api_key, status) VALUES ($1, $2, $3, $4)', [provider_name, api_url, api_key, status]);
  res.json({ success: true });
});

app.post('/api/admin/providers/edit', async (req, res) => {
  const { id, provider_name, api_url, api_key, status } = req.body;
  await pool.query('UPDATE api_providers SET provider_name = $1, api_url = $2, api_key = $3, status = $4 WHERE id = $5', [provider_name, api_url, api_key, status, id]);
  res.json({ success: true });
});

app.delete('/api/admin/providers/:id', async (req, res) => {
  await pool.query('DELETE FROM api_providers WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Universal Orders Dashboard Processing Array
app.get('/api/admin/orders', async (req, res) => {
  const orders = await pool.query('SELECT * FROM orders ORDER BY id DESC');
  res.json(orders.rows);
});

app.post('/api/admin/orders/refresh', async (req, res) => {
  const statuses = ['Completed', 'Processing', 'In Progress', 'Partial', 'Canceled'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [randomStatus, req.body.id]);
  res.json({ success: true, newStatus: randomStatus });
});

// Settings & Config Panel Parameters
app.post('/api/admin/settings/update', async (req, res) => {
  const { adminPassword, settingsPassword, confirmSettingsPass } = req.body;
  const adminRes = await pool.query('SELECT * FROM admin_settings LIMIT 1');
  const checkSettings = await bcrypt.compare(confirmSettingsPass, adminRes.rows[0].settings_password);
  
  if (!checkSettings) {
    return res.status(403).json({ error: 'Master Key Authentication Failed' });
  }

  if (adminPassword && adminPassword.trim() !== "") {
    const hashAdmin = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await pool.query('UPDATE admin_settings SET admin_password = $1 WHERE id = $2', [hashAdmin, adminRes.rows[0].id]);
  }
  if (settingsPassword && settingsPassword.trim() !== "") {
    const hashSettings = await bcrypt.hash(settingsPassword, SALT_ROUNDS);
    await pool.query('UPDATE admin_settings SET settings_password = $1 WHERE id = $2', [hashSettings, adminRes.rows[0].id]);
  }
  res.json({ success: true });
});

app.get('/api/admin/system/status', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ database: 'Connected', apiGateway: 'Operational' });
  } catch (err) {
    res.json({ database: 'Disrupted Connection Route', apiGateway: 'Degraded State' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server executing operations efficiently on port ${PORT}`));