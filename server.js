const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Universal Global Middleware Connectors Pipelines
app.use(cors());
app.use(express.json());

// Main Connection Pool Infrastructure Strategy Handler Assignment Matrix
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Structural Schema Initialization Handlers
async function bootstrapDatabaseSchemaArchitectureModels() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Client Registry Context Storage Units
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        balance NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // External Upstream Gate Link Storage Profiles
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_providers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Catalog Offerings Allocation Intercept Mappings Data Maps
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        api_provider_id INT REFERENCES api_providers(id) ON DELETE CASCADE,
        remote_service_id INT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC(12, 4) NOT NULL,
        min_quantity INT NOT NULL,
        max_quantity INT NOT NULL,
        enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Master Pipelines Core Orders Tracking Registries Matrix Elements
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        service_id INT REFERENCES services(id) ON DELETE SET NULL,
        provider_order_id VARCHAR(100),
        link TEXT NOT NULL,
        quantity INT NOT NULL,
        price NUMERIC(12, 4) NOT NULL,
        status VARCHAR(50) DEFAULT 'Processing' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Global Governance Infrastructure Variable Settings Storage Key Store
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_val TEXT NOT NULL
      );
    `);

    // Seed default master administrative secret keys vector map parameters securely if missing
    const rootSearch = await client.query("SELECT * FROM admin_settings WHERE config_key = 'admin_password'");
    if (rootSearch.rows.length === 0) {
      const defaultRootHashSecret = await bcrypt.hash("gowind_admin_secure_vault_pass_v3", 10);
      await client.query("INSERT INTO admin_settings (config_key, config_val) VALUES ('admin_password', $1)", [defaultRootHashSecret]);
    }

    await client.query('COMMIT');
    console.log('Database schema bootstrap verified and initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database bootstrap crash failure:', err);
  } finally {
    client.release();
  }
}

bootstrapDatabaseSchemaArchitectureModels();

// ==========================================
// AUTHENTICATION INTERCEPT SERVICES LOGIC ENDPOINTS
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing evaluation credentials parameter fields' });
  try {
    const userSearch = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userSearch.rows.length === 0) return res.status(401).json({ error: 'Access identity record context map lookup failure' });
    const u = userSearch.rows[0];
    const match = await bcrypt.compare(password, u.password);
    if (!match) return res.status(401).json({ error: 'Invalid security cryptographic handshake passphrase' });
    
    return res.json({ message: 'Authentication established', user: { id: u.id, username: u.username, balance: parseFloat(u.balance) } });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/admin', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Master administrative access token required' });
  try {
    const adminSearch = await pool.query("SELECT config_val FROM admin_settings WHERE config_key = 'admin_password'");
    if (adminSearch.rows.length === 0) return res.status(500).json({ error: 'Core infrastructure state definition failure' });
    
    const match = await bcrypt.compare(password, adminSearch.rows[0].config_val);
    if (!match) return res.status(401).json({ error: 'Cryptographic master verification authority rejected key chain assertions' });
    
    return res.json({ authenticated: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ==========================================
// CLIENTS PROFILES & ACCOUNT OPERATIONS SCOPES INTERCEPTORS
// ==========================================

app.get('/api/user/:id', async (req, res) => {
  try {
    const u = await pool.query('SELECT id, username, balance FROM users WHERE id = $1', [parseInt(req.params.id)]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Client target registration mapping row index missing' });
    return res.json({ user: { id: u.rows[0].id, username: u.rows[0].username, balance: parseFloat(u.rows[0].balance) } });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/services/active', async (req, res) => {
  try {
    const queryStr = `
      SELECT s.*, p.name as provider_name 
      FROM services s
      JOIN api_providers p ON s.api_provider_id = p.id
      WHERE s.enabled = true AND p.enabled = true
      ORDER BY s.id ASC
    `;
    const data = await pool.query(queryStr);
    return res.json({ services: data.rows.map(x => ({ ...x, price: parseFloat(x.price) })) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ==========================================
// TRANSACTIONAL PIPELINES ENGINE IMPLEMENTATIONS (REAL SMM INTEGRATION)
// ==========================================

app.post('/api/orders/new', async (req, res) => {
  const { userId, serviceId, link, quantity } = req.body;
  if (!userId || !serviceId || !link || !quantity) {
    return res.status(400).json({ error: 'Missing active telemetry deployment transaction fields parameters' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Lock and check user record
    const uSearch = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [parseInt(userId)]);
    if (uSearch.rows.length === 0) throw new Error('Client context registration target node broken');
    const userRow = uSearch.rows[0];

    // 2. Fetch service data along with provider authentication variables
    const sSearch = await client.query(`
      SELECT s.*, p.api_url, p.api_key, p.enabled as provider_enabled 
      FROM services s 
      JOIN api_providers p ON s.api_provider_id = p.id 
      WHERE s.id = $1
    `, [parseInt(serviceId)]);
    if (sSearch.rows.length === 0) throw new Error('Catalog offerings element target reference map index invalid');
    const svcRow = sSearch.rows[0];

    if (!svcRow.enabled || !svcRow.provider_enabled) throw new Error('Target selection strategy profile is globally offline');
    if (quantity < svcRow.min_quantity || quantity > svcRow.max_quantity) {
      throw new Error(`Quantity specification out of boundaries constraints (${svcRow.min_quantity} - ${svcRow.max_quantity})`);
    }

    const calculatedPriceCost = (quantity / 1000) * parseFloat(svcRow.price);
    if (parseFloat(userRow.balance) < calculatedPriceCost) throw new Error('Insufficient client capital funds');

    // 3. Deduct local balance
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [calculatedPriceCost, userRow.id]);

    // ========================================================
    // NATIVE SMM PROVIDER POST HANDSHAKE INTEGRATION
    // ========================================================
    const providerPayload = new URLSearchParams();
    providerPayload.append('key', svcRow.api_key);
    providerPayload.append('action', 'add');
    providerPayload.append('service', svcRow.remote_service_id.toString());
    providerPayload.append('url', link.trim());
    providerPayload.append('quantity', quantity.toString());

    let providerOrderId = null;
    let initialStatus = 'Processing';

    try {
      const providerResponse = await fetch(svcRow.api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: providerPayload.toString()
      });

      const providerData = await providerResponse.json();

      if (providerResponse.ok && providerData && providerData.order) {
        providerOrderId = providerData.order.toString(); // Captures actual number generated (e.g. 23501)
      } else {
        throw new Error(providerData.error || 'Provider execution API rejected format syntax parameters');
      }
    } catch (apiErr) {
      console.error("Provider pipeline communication error:", apiErr.message);
      throw new Error("Upstream Provider Connectivity Error: " + apiErr.message);
    }

    // 4. Record output directly into local data tables rows
    const insertOrderLogResult = await client.query(`
      INSERT INTO orders (user_id, service_id, provider_order_id, link, quantity, price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [userRow.id, svcRow.id, providerOrderId, link.trim(), quantity, calculatedPriceCost, initialStatus]);

    await client.query('COMMIT');
    return res.json({ success: true, orderId: insertOrderLogResult.rows[0].id, remoteId: providerOrderId });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/orders/user/:id', async (req, res) => {
  try {
    const qStr = `
      SELECT o.*, s.name as service_name 
      FROM orders o 
      LEFT JOIN services s ON o.service_id = s.id 
      WHERE o.user_id = $1 
      ORDER BY o.created_at DESC
    `;
    const data = await pool.query(qStr, [parseInt(req.params.id)]);
    return res.json({ orders: data.rows.map(x => ({ ...x, price: parseFloat(x.price) })) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMINISTRATIVE PLATFORM CONTROL MATRICES APIS
// ==========================================

app.get('/api/admin/metrics', async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*)::int as count, SUM(balance)::numeric as bal FROM users');
    const ordersCount = await pool.query('SELECT COUNT(*)::int as count FROM orders');
    const servicesCount = await pool.query('SELECT COUNT(*)::int as count FROM services');
    const providersCount = await pool.query('SELECT COUNT(*)::int as count FROM api_providers');

    return res.json({
      metrics: {
        totalUsers: usersCount.rows[0].count || 0,
        totalBalance: parseFloat(usersCount.rows[0].bal || 0),
        totalOrders: ordersCount.rows[0].count || 0,
        totalServices: servicesCount.rows[0].count || 0,
        totalProviders: providersCount.rows[0].count || 0
      }
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Admin Users Sub-System Operations CRUD Matrix
app.get('/api/admin/users', async (req, res) => {
  try {
    const data = await pool.query('SELECT id, username, balance FROM users ORDER BY id DESC');
    return res.json({ users: data.rows.map(x => ({ ...x, balance: parseFloat(x.balance) })) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users', async (req, res) => {
  const { username, password, balance } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing core target parameters definitions' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password, balance) VALUES ($1, $2, $3)', [username.trim(), hash, balance || 0]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/users', async (req, res) => {
  const { id, username, password, balance } = req.body;
  try {
    if (password && password.trim() !== "") {
      const freshHash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET username=$1, password=$2, balance=$3 WHERE id=$4', [username.trim(), freshHash, balance, parseInt(id)]);
    } else {
      await pool.query('UPDATE users SET username=$1, balance=$2 WHERE id=$3', [username.trim(), balance, parseInt(id)]);
    }
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [parseInt(req.query.id)]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Admin Catalog Offerings Services Sub-System CRUD Matrix
app.get('/api/admin/services', async (req, res) => {
  try {
    const q = `
      SELECT s.*, p.name as provider_name 
      FROM services s 
      LEFT JOIN api_providers p ON s.api_provider_id = p.id 
      ORDER BY s.id DESC
    `;
    const data = await pool.query(q);
    return res.json({ services: data.rows.map(x => ({ ...x, price: parseFloat(x.price) })) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/services', async (req, res) => {
  const { api_provider_id, remote_service_id, name, price, min_quantity, max_quantity, enabled } = req.body;
  try {
    await pool.query(`
      INSERT INTO services (api_provider_id, remote_service_id, name, price, min_quantity, max_quantity, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [api_provider_id, remote_service_id, name.trim(), price, min_quantity, max_quantity, enabled]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/services', async (req, res) => {
  const { id, api_provider_id, remote_service_id, name, price, min_quantity, max_quantity, enabled } = req.body;
  try {
    await pool.query(`
      UPDATE services SET api_provider_id=$1, remote_service_id=$2, name=$3, price=$4, min_quantity=$5, max_quantity=$6, enabled=$7
      WHERE id=$8
    `, [api_provider_id, remote_service_id, name.trim(), price, min_quantity, max_quantity, enabled, parseInt(id)]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/services', async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [parseInt(req.query.id)]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Admin External Providers Intercept Engines Connections CRUD Matrix
app.get('/api/admin/providers', async (req, res) => {
  try {
    const data = await pool.query('SELECT * FROM api_providers ORDER BY id DESC');
    return res.json({ providers: data.rows });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/providers', async (req, res) => {
  const { name, api_url, api_key, enabled } = req.body;
  try {
    await pool.query('INSERT INTO api_providers (name, api_url, api_key, enabled) VALUES ($1, $2, $3, $4)', [name.trim(), api_url.trim(), api_key.trim(), enabled]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/providers', async (req, res) => {
  const { id, name, api_url, api_key, enabled } = req.body;
  try {
    await pool.query('UPDATE api_providers SET name=$1, api_url=$2, api_key=$3, enabled=$4 WHERE id=$5', [name.trim(), api_url.trim(), api_key.trim(), enabled, parseInt(id)]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/providers', async (req, res) => {
  try {
    await pool.query('DELETE FROM api_providers WHERE id = $1', [parseInt(req.query.id)]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Comprehensive Audits Logs Control Interceptor Endpoints
app.get('/api/admin/orders', async (req, res) => {
  try {
    const data = await pool.query('SELECT o.*, u.username, s.name as service_name FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN services s ON o.service_id = s.id ORDER BY o.id DESC');
    return res.json({ orders: data.rows.map(x => ({ ...x, price: parseFloat(x.price) })) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Security Settings Update Configuration Controller Interceptor Handler
app.post('/api/admin/settings/update', async (req, res) => {
  const { currentPassword, newAdminPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Verification current PIN required to pass operational gateway context barriers' });
  
  try {
    const adminSearch = await pool.query("SELECT config_val FROM admin_settings WHERE config_key = 'admin_password'");
    const match = await bcrypt.compare(currentPassword, adminSearch.rows[0].config_val);
    if (!match) return res.status(401).json({ error: 'Validation master secret assertion failed' });

    if (newAdminPassword && newAdminPassword.trim() !== "") {
      const nextHashSecret = await bcrypt.hash(newAdminPassword, 10);
      await pool.query("UPDATE admin_settings SET config_val = $1 WHERE config_key = 'admin_password'", [nextHashSecret]);
    }
    
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// Diagnostic System Pulse Communication Checker Endpoints
app.get('/api/admin/system/status', async (req, res) => {
  try {
    const pulseCheck = await pool.query('SELECT NOW()');
    if (pulseCheck.rows.length > 0) {
      return res.json({ databaseConnected: true });
    }
    throw new Error();
  } catch (e) {
    return res.status(500).json({ databaseConnected: false, error: 'Database pipeline structural discontinuity anomaly detected' });
  }
});

// Initialize Listener Channels Interfaces
app.listen(PORT, () => {
  console.log(`GOWIND SMM PANEL V3 Core Runtime Server established running on port channel: ${PORT}`);
});
