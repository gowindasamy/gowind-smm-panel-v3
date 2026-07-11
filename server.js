require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const db = require("./db");

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

/* ===========================
   HOME
=========================== */

app.get("/", (req, res) => {
    res.json({
        success: true,
        name: "Gowind SMM Panel",
        version: "3.1.0",
        status: "Online"
    });
});

/* ===========================
   HEALTH
=========================== */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        uptime: process.uptime()
    });
});

/* ===========================
   DATABASE TEST
=========================== */

app.get("/db-test", async (req, res) => {

    try{

        const result = await db.query("SELECT NOW()");

        res.json({
            success:true,
            database:"Connected",
            time:result.rows[0]
        });

    }catch(err){

console.error(err);

res.status(500).json({

success:false,
message:err.message

});

}

});

/* ===========================
   DATABASE SETUP
=========================== */

app.get("/setup", async (req,res)=>{

try{

await db.query(`
CREATE TABLE IF NOT EXISTS users(
id SERIAL PRIMARY KEY,
username VARCHAR(50) UNIQUE NOT NULL,
password TEXT NOT NULL,
role VARCHAR(20) DEFAULT 'user',
wallet DECIMAL(10,2) DEFAULT 0,
status BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS providers(
id SERIAL PRIMARY KEY,
name VARCHAR(100),
api_url TEXT,
api_key TEXT,
status BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS services(
id SERIAL PRIMARY KEY,
provider_id INT,
provider_service_id INT,
service_id INT,
name VARCHAR(255),
category VARCHAR(150),
rate DECIMAL(10,2),
min INT,
max INT,
status BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE UNIQUE INDEX IF NOT EXISTS services_provider_unique
ON services(provider_id,provider_service_id);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS orders(
id SERIAL PRIMARY KEY,
user_id INT,
provider_id INT,
provider_order_id BIGINT,
service_id INT,
link TEXT,
quantity INT,
charge DECIMAL(10,2),
status VARCHAR(30) DEFAULT 'Pending',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);
await db.query(`
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS provider_id INT;
`);

await db.query(`
ALTER TABLE services
ADD COLUMN IF NOT EXISTS provider_service_id INT;
`);
await db.query(`
CREATE TABLE IF NOT EXISTS transactions(
id SERIAL PRIMARY KEY,
user_id INT,
amount DECIMAL(10,2),
type VARCHAR(20),
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

await db.query(`
CREATE TABLE IF NOT EXISTS settings(
id SERIAL PRIMARY KEY,
site_name VARCHAR(100),
currency VARCHAR(10),
maintenance BOOLEAN DEFAULT FALSE
);
`);

res.json({
success:true,
message:"Database Ready"
});

}catch(err){

res.status(500).json({
success:false,
error:err.message
});

}

});

/* ===========================
   LOGIN
=========================== */

app.post("/api/login",async(req,res)=>{

try{

const {username,password}=req.body;

const result=await db.query(
"SELECT * FROM users WHERE username=$1",
[username]
);

if(result.rows.length===0){

return res.status(401).json({
success:false,
message:"Invalid Username"
});

}

const user=result.rows[0];

const match=await bcrypt.compare(
password,
user.password
);

if(!match){

return res.status(401).json({
success:false,
message:"Invalid Password"
});

}

const token=jwt.sign({

id:user.id,
username:user.username,
role:user.role

},
process.env.JWT_SECRET,
{
expiresIn:"1d"
});

res.json({

success:true,
message:"Login Successful",
token,
user

});

}catch(err){

res.status(500).json({

success:false,
error:err.message

});

}

});

/* ===========================
   REGISTER
=========================== */

app.post("/api/register",async(req,res)=>{

try{

const {username,password,role}=req.body;

const check=await db.query(
"SELECT * FROM users WHERE username=$1",
[username]
);

if(check.rows.length>0){

return res.json({
success:false,
message:"Username already exists"
});

}

const hash=await bcrypt.hash(password,10);

await db.query(

`INSERT INTO users
(username,password,role)
VALUES($1,$2,$3)`,

[
username,
hash,
role || "user"
]

);

res.json({

success:true,
message:"User Registered Successfully"

});

}catch(err){

res.status(500).json({

success:false,
error:err.message

});

}

});
/* ===========================
   ADD SERVICE
=========================== */

app.post("/api/services", async (req, res) => {

    try {

        const {
            provider_id,
            provider_service_id,
            name,
            category,
            rate,
            min,
            max
        } = req.body;

        await db.query(
            `INSERT INTO services
(
provider_id,
provider_service_id,
name,
category,
rate,
min,
max
)
VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [
    provider_id,
    provider_service_id,
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

/* ===========================
   GET SERVICES
=========================== */

app.get("/api/services", async (req, res) => {

    try {

        const result = await db.query(`
SELECT
    s.*,
    p.name AS provider_name
FROM services s
LEFT JOIN providers p
ON s.provider_id = p.id
WHERE s.status = TRUE
ORDER BY s.id ASC
`);

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

/* ===========================
   GET SINGLE SERVICE
=========================== */

app.get("/api/services/:id", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT * FROM services WHERE id=$1",
            [req.params.id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Service not found"
            });

        }

        res.json({
            success: true,
            service: result.rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
/* ===========================
   UPDATE SERVICE
=========================== */

app.put("/api/services/:id", async (req, res) => {

    try {

        const {
            name,
            category,
            rate,
            min,
            max,
            status
        } = req.body;

        await db.query(
            `UPDATE services
             SET
                name = $1,
                category = $2,
                rate = $3,
                min = $4,
                max = $5,
                status = $6
             WHERE id = $7`,
            [
                name,
                category,
                rate,
                min,
                max,
                status,
                req.params.id
            ]
        );

        res.json({
            success: true,
            message: "Service Updated Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
/* ===========================
   WALLET BALANCE
=========================== */

app.get("/api/wallet/:userId", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT wallet FROM users WHERE id=$1",
            [req.params.userId]
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

/* ===========================
   ADD WALLET
=========================== */

app.post("/api/wallet/add", async (req, res) => {

    try {

        const { user_id, amount } = req.body;

        await db.query(
            "UPDATE users SET wallet=wallet+$1 WHERE id=$2",
            [amount, user_id]
        );

        await db.query(
            `INSERT INTO transactions
            (user_id,amount,type)
            VALUES($1,$2,$3)`,
            [
                user_id,
                amount,
                "Credit"
            ]
        );

        res.json({
            success: true,
            message: "Wallet Updated Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

/* ===========================
   TRANSACTION HISTORY
=========================== */

app.get("/api/transactions/:userId", async (req, res) => {

    try {

        const result = await db.query(
            `SELECT *
             FROM transactions
             WHERE user_id=$1
             ORDER BY id DESC`,
            [req.params.userId]
        );

        res.json({
            success: true,
            total: result.rows.length,
            transactions: result.rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
/* ===========================
   PLACE ORDER
=========================== */
app.post("/api/orders", async (req, res) => {

    try {

        const { user_id, service_id, link, quantity } = req.body;

        // Service
        const serviceResult = await db.query(
            "SELECT * FROM services WHERE id=$1",
            [service_id]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        const service = serviceResult.rows[0];

        // Provider
        const providerResult = await db.query(
            "SELECT * FROM providers WHERE id=$1",
            [service.provider_id]
        );

        if (providerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const provider = providerResult.rows[0];

        // Charge
        const charge =
            (Number(service.rate) * Number(quantity)) / 1000;

        // Wallet
        const walletResult = await db.query(
            "SELECT wallet FROM users WHERE id=$1",
            [user_id]
        );

        const wallet =
            Number(walletResult.rows[0].wallet);

        if (wallet < charge) {
            return res.status(400).json({
                success: false,
                message: "Insufficient Wallet Balance"
            });
        }

        // Send Order to Provider
        const providerResponse = await axios.post(

            provider.api_url,

            new URLSearchParams({

                key: provider.api_key,
                action: "add",
                service: service.provider_service_id,
                link: link,
                quantity: quantity

            }),

            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }

        );

        if (!providerResponse.data.order) {

            return res.status(400).json({
                success: false,
                provider: providerResponse.data
            });

        }

        const providerOrderId =
            providerResponse.data.order;

        // Wallet Deduct
        await db.query(
            "UPDATE users SET wallet=wallet-$1 WHERE id=$2",
            [charge, user_id]
        );

        // Transaction
        await db.query(
            `INSERT INTO transactions
            (user_id,amount,type)
            VALUES($1,$2,$3)`,
            [
                user_id,
                charge,
                "Debit"
            ]
        );

        // Save Order
        await db.query(

            `INSERT INTO orders
            (
                user_id,
                provider_id,
                provider_order_id,
                service_id,
                link,
                quantity,
                charge,
                status
            )
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,

            [
                user_id,
                provider.id,
                providerOrderId,
                service.id,
                link,
                quantity,
                charge,
                "Pending"
            ]

        );

        res.json({

            success: true,
            provider_order_id: providerOrderId,
            charge

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});
/* ===========================
   GET ORDERS
=========================== */

app.get("/api/orders", async(req,res)=>{

    try{

        const result=await db.query(
        "SELECT * FROM orders ORDER BY id DESC"
        );

        res.json({
            success:true,
            total:result.rows.length,
            orders:result.rows
        });

    }catch(err){

        res.status(500).json({
            success:false,
            error:err.message
        });

    }

});

/* ===========================
   ADD PROVIDER
=========================== */

app.post("/api/providers",async(req,res)=>{

    try{

        const{
            name,
            api_url,
            api_key
        }=req.body;

        await db.query(

        `INSERT INTO providers
        (name,api_url,api_key)
        VALUES($1,$2,$3)`,

        [
            name,
            api_url,
            api_key
        ]

        );

        res.json({
            success:true,
            message:"Provider Added Successfully"
        });

    }catch(err){

        res.status(500).json({
            success:false,
            error:err.message
        });

    }

});

/* ===========================
   GET PROVIDERS
=========================== */

app.get("/api/providers",async(req,res)=>{

    try{

        const result=await db.query(
        "SELECT * FROM providers ORDER BY id ASC"
        );

        res.json({

            success:true,
            total:result.rows.length,
            providers:result.rows

        });

    }catch(err){

        res.status(500).json({

            success:false,
            error:err.message

        });

    }

});
/* ===========================
   IMPORT SERVICES
=========================== */

app.post("/api/providers/import", async (req, res) => {

    try {

        const { provider_id } = req.body;

        const providerResult = await db.query(
            "SELECT * FROM providers WHERE id=$1",
            [provider_id]
        );

        if (providerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const provider = providerResult.rows[0];

        const response = await axios.post(
            provider.api_url,
            new URLSearchParams({
                key: provider.api_key,
                action: "services"
            }),
            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        const services = response.data;

        let imported = 0;

        for (const service of services) {

            await db.query(
                `INSERT INTO services
                (
                    provider_id,
                    provider_service_id,
                    service_id,
                    name,
                    category,
                    rate,
                    min,
                    max
                )
                VALUES($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT DO NOTHING`,
                [
                    provider.id,
                    Number(service.service),
                    Number(service.service),
                    service.name,
                    service.category,
                    Number(service.rate),
                    Number(service.min),
                    Number(service.max)
                ]
            );

            imported++;

        }

        res.json({
            success: true,
            imported
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

/* ===========================
   PROVIDER BALANCE
=========================== */

app.get("/api/providers/:id/balance", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT * FROM providers WHERE id=$1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const provider = result.rows[0];

        const response = await axios.post(
            provider.api_url,
            new URLSearchParams({
                key: provider.api_key,
                action: "balance"
            }),
            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        res.json(response.data);

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

/* ===========================
   PROVIDER ORDER STATUS
=========================== */

app.post("/api/providers/status", async (req, res) => {

    try {

        const { provider_id, order } = req.body;

        const result = await db.query(
            "SELECT * FROM providers WHERE id=$1",
            [provider_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const provider = result.rows[0];

        const response = await axios.post(
            provider.api_url,
            new URLSearchParams({
                key: provider.api_key,
                action: "status",
                order
            }),
            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        res.json(response.data);

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

/* ===========================
   CANCEL ORDER
=========================== */

app.post("/api/providers/cancel", async (req, res) => {

    try {

        const { provider_id, order } = req.body;

        const result = await db.query(
            "SELECT * FROM providers WHERE id=$1",
            [provider_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const provider = result.rows[0];

        const response = await axios.post(
            provider.api_url,
            new URLSearchParams({
                key: provider.api_key,
                action: "cancel",
                order
            }),
            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        res.json(response.data);

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

/* ===========================
   SYNC ALL ORDER STATUS
=========================== */

app.get("/api/providers/sync", async (req, res) => {

    try {

        const orders = await db.query(`
            SELECT
                o.id,
                o.provider_order_id,
                o.provider_id,
                p.api_url,
                p.api_key
            FROM orders o
            JOIN providers p
            ON o.provider_id = p.id
            WHERE o.provider_order_id IS NOT NULL
        `);

        let updated = 0;

        for (const order of orders.rows) {

            const response = await axios.post(
                order.api_url,
                new URLSearchParams({
                    key: order.api_key,
                    action: "status",
                    order: order.provider_order_id
                }),
                {
                    headers: {
                        "Content-Type":
                        "application/x-www-form-urlencoded"
                    }
                }
            );

            if (response.data.status) {

                await db.query(
                    `UPDATE orders
                     SET status = $1
                     WHERE id = $2`,
                    [
                        response.data.status,
                        order.id
                    ]
                );

                updated++;

            }

        }

        res.json({
            success: true,
            updated
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
/* ===========================
   ADMIN DASHBOARD
=========================== */

app.get("/api/admin/dashboard", async (req, res) => {

    try {

        const users = await db.query(
            "SELECT COUNT(*) AS total FROM users"
        );

        const orders = await db.query(
            "SELECT COUNT(*) AS total FROM orders"
        );

        const providers = await db.query(
            "SELECT COUNT(*) AS total FROM providers"
        );

        const services = await db.query(
            "SELECT COUNT(*) AS total FROM services"
        );

        const revenue = await db.query(
            "SELECT COALESCE(SUM(charge),0) AS total FROM orders"
        );

        res.json({

            success: true,

            dashboard: {

                users: Number(users.rows[0].total),

                orders: Number(orders.rows[0].total),

                providers: Number(providers.rows[0].total),

                services: Number(services.rows[0].total),

                revenue: Number(revenue.rows[0].total)

            }

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});
/* ===========================
   DELETE SERVICE
=========================== */

app.delete("/api/services/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM services WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Service Deleted Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
app.delete("/api/providers/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM providers WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Provider Deleted Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
app.get("/api/users", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT id, username, role, wallet FROM users ORDER BY id ASC"
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
app.delete("/api/users/:id", async (req, res) => {

    try {

        await db.query(
            "DELETE FROM users WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "User Deleted Successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
/* ===========================
   GET SETTINGS
=========================== */

app.get("/api/settings", async (req, res) => {

    try {

        const result = await db.query(
            "SELECT * FROM settings LIMIT 1"
        );

        if(result.rows.length === 0){

            return res.json({
                success:true,
                settings:{
                    site_name:"Gowind SMM Panel",
                    maintenance:false
                }
            });

        }

        res.json({
            success:true,
            settings:result.rows[0]
        });

    } catch(err){

        res.status(500).json({
            success:false,
            error:err.message
        });

    }

});
/* ===========================
   SAVE SETTINGS
=========================== */

app.post("/api/settings", async (req, res) => {

    try {

        const { site_name, maintenance } = req.body;

        const check = await db.query(
            "SELECT id FROM settings LIMIT 1"
        );

        if(check.rows.length === 0){

            await db.query(

                `INSERT INTO settings
                (site_name,maintenance)
                VALUES($1,$2)`,

                [
                    site_name,
                    maintenance
                ]

            );

        }else{

            await db.query(

                `UPDATE settings
                 SET site_name=$1,
                     maintenance=$2
                 WHERE id=$3`,

                [
                    site_name,
                    maintenance,
                    check.rows[0].id
                ]

            );

        }

        res.json({
            success:true,
            message:"Settings Saved Successfully"
        });

    } catch(err){

        res.status(500).json({
            success:false,
            error:err.message
        });

    }

});
/* ===========================
   DELETE ALL SERVICES
=========================== */

app.delete("/api/services", async(req,res)=>{

try{

await db.query("DELETE FROM services");

res.json({

success:true,

message:"All Services Deleted Successfully"

});

}catch(err){

res.status(500).json({

success:false,

error:err.message

});

}

});
app.get("/api/orders-columns", async (req, res) => {

    const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='orders'
        ORDER BY ordinal_position
    `);

    res.json(result.rows);

});
/* ===========================
   SERVER START
=========================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

});
