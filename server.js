const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Setup
const MONGO_URI = process.env.MONGO_URI;
let db = null;

if (MONGO_URI) {
    const client = new MongoClient(MONGO_URI);
    client.connect().then(() => {
        db = client.db('pwa_cashier');
        console.log('Connected to MongoDB Cloud Database!');
    }).catch(err => console.error('MongoDB connection error:', err));
} else {
    console.log('No MONGO_URI provided. Falling back to local JSON files.');
}

// Helper to read users
async function readUsers() {
    if (db) {
        try {
            const usersRaw = await db.collection('users').find({}).toArray();
            const users = usersRaw.map(u => ({ ...u, showBcdValue: u.showBcdValue ?? false }));
            if (users.length === 0) {
                return [{ id: 1, username: 'admin', password: 'password123', showBcdValue: false }];
            }
            return users;
        } catch (e) {
            console.error('DB Read Error:', e);
            return [];
        }
    }
    
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(data);
        return users.map(u => ({ ...u, showBcdValue: u.showBcdValue ?? false }));
    } catch (err) {
        return [{ id: 1, username: 'admin', password: 'password123', showBcdValue: false }];
    }
}

// Helper to write users
async function writeUsers(users) {
    if (db) {
        await db.collection('users').deleteMany({});
        if (users.length > 0) {
            await db.collection('users').insertMany(users);
        }
        return;
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// Helper to read config
async function readConfig() {
    const defaultConfig = { prefixId: '', isDefault: false, defPrfxId: '', defSfxId: '', bcdAPIVal: '' };
    if (db) {
        try {
            const config = await db.collection('config').findOne({ _id: 'main' });
            return config ? { ...defaultConfig, ...config } : defaultConfig;
        } catch (e) {
            return defaultConfig;
        }
    }
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return { ...defaultConfig, ...JSON.parse(data) };
    } catch (err) {
        return defaultConfig;
    }
}

// Helper to write config
async function writeConfig(config) {
    if (db) {
        await db.collection('config').updateOne(
            { _id: 'main' },
            { $set: config },
            { upsert: true }
        );
        return;
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ---------------------------
// Auth Routes
// ---------------------------

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await readUsers();
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, message: 'Login successful', username: user.username, showBcdValue: !!user.showBcdValue });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

// Admin - Create user
app.post('/api/users', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const users = await readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    
    users.push({ id: Date.now(), username, password, showBcdValue: !!req.body.showBcdValue });
    await writeUsers(users);
    
    res.json({ success: true, message: 'User created successfully' });
});

// Admin - Change password
app.put('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ success: false, message: 'New password is required' });
    }
    
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    users[userIndex].password = newPassword;
    await writeUsers(users);
    
    res.json({ success: true, message: 'Password updated successfully' });
});

// Admin - List users
app.get('/api/users', async (req, res) => {
    const users = await readUsers();
    // Don't send passwords
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
});

// Admin - Toggle showBcdValue
app.put('/api/users/:username/settings', async (req, res) => {
    const { username } = req.params;
    const { showBcdValue } = req.body;
    
    if (showBcdValue === undefined) {
        return res.status(400).json({ success: false, message: 'showBcdValue is required' });
    }
    
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    users[userIndex].showBcdValue = !!showBcdValue;
    await writeUsers(users);
    
    res.json({ success: true, message: 'Settings updated successfully' });
});

function findVendorData(data, targetVendor) {
    const requests = Array.isArray(data) ? data : (data.value || data.requests || []);
    return requests.find(req => {
        if (!req || typeof req !== 'object') return false;
        if (req.vendor === targetVendor || req.vendorCode === targetVendor) return true;
        if (req.vendor && typeof req.vendor === 'object') {
            return req.vendor.navVendorNo === targetVendor || req.vendor.vendorCode === targetVendor;
        }
        return false;
    });
}

// ---------------------------
// Config Routes
// ---------------------------
app.get('/api/config', async (req, res) => {
    res.json(await readConfig());
});

app.post('/api/config', async (req, res) => {
    const config = await readConfig();
    if (req.body.prefixId !== undefined) {
        config.prefixId = req.body.prefixId;
    }
    if (req.body.isDefault !== undefined) {
        config.isDefault = req.body.isDefault;
    }
    if (req.body.defPrfxId !== undefined) {
        config.defPrfxId = req.body.defPrfxId;
    }
    if (req.body.defSfxId !== undefined) {
        config.defSfxId = req.body.defSfxId;
    }
    if (req.body.bcdAPIVal !== undefined) {
        config.bcdAPIVal = req.body.bcdAPIVal;
    }
    await writeConfig(config);
    res.json({ success: true, message: 'Config updated', config });
});

// External quick update APIs
app.get('/api/update-sfx', async (req, res) => {
    const newVal = req.query.val;
    if (newVal !== undefined) {
        const config = await readConfig();
        config.defSfxId = newVal;
        await writeConfig(config);
        return res.json({ success: true, message: 'DefSfxId updated externally', defSfxId: config.defSfxId });
    }
    res.status(400).json({ success: false, message: 'Missing val parameter. Usage: /api/update-sfx?val=NEW_VALUE' });
});

app.get('/api/update-bcd-api-val', async (req, res) => {
    const newVal = req.query.val;
    if (newVal !== undefined) {
        const config = await readConfig();
        config.bcdAPIVal = newVal;
        await writeConfig(config);
        return res.json({ success: true, message: 'BcdAPIVal updated externally', bcdAPIVal: config.bcdAPIVal });
    }
    res.status(400).json({ success: false, message: 'Missing val parameter. Usage: /api/update-bcd-api-val?val=NEW_VALUE' });
});

// ---------------------------
// Barcode Data Route
// ---------------------------
app.get('/api/barcode-data', async (req, res) => {
    try {
        const response = await fetch('https://52.1.46.220.sslip.io/api/sync/requests', {
            headers: {
                'x-api-key': 'vp_live_k9a2b5c8d1e4f7g0h3i6j9k2l5m8n1o4'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();
        const targetRequest = findVendorData(data, 'VEND0001');
        
        if (!targetRequest) {
            return res.status(404).json({ success: false, message: 'Vendor VEND0001 not found or no requests available.' });
        }
        
        const erpReference = targetRequest.erpReference;
        if (!erpReference) {
            return res.status(404).json({ success: false, message: 'erpReference not found in vendor data.' });
        }
        
        res.json({ success: true, erpReference });

    } catch (error) {
        console.error('Error fetching barcode data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch data from external API.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server available on:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://192.168.105.53:${PORT}`);
});
