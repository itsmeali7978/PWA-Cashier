const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read users
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Helper to write users
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// Helper to read config
function readConfig() {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { prefixId: '', isDefault: false, defPrfxId: '', defSfxId: '', bcdAPIVal: '' };
    }
}

// Helper to write config
function writeConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ---------------------------
// Auth Routes
// ---------------------------

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, message: 'Login successful', username: user.username });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

// Admin - Create user
app.post('/api/users', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    
    users.push({ id: Date.now(), username, password });
    writeUsers(users);
    
    res.json({ success: true, message: 'User created successfully' });
});

// Admin - Change password
app.put('/api/users/:username', (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ success: false, message: 'New password is required' });
    }
    
    const users = readUsers();
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    users[userIndex].password = newPassword;
    writeUsers(users);
    
    res.json({ success: true, message: 'Password updated successfully' });
});

function findVendorData(data, targetVendor) {
    // The API returns the array of requests under "value"
    const requests = Array.isArray(data) ? data : (data.value || data.requests || []);
    
    // Find the request where the vendor matches "VEND0001"
    return requests.find(req => {
        if (!req || typeof req !== 'object') return false;
        
        // Sometimes vendor is just a string
        if (req.vendor === targetVendor || req.vendorCode === targetVendor) return true;
        
        // Or it's a nested object (which contains the navVendorNo)
        if (req.vendor && typeof req.vendor === 'object') {
            return req.vendor.navVendorNo === targetVendor || req.vendor.vendorCode === targetVendor;
        }
        
        return false;
    });
}

// ---------------------------
// Config Routes
// ---------------------------
app.get('/api/config', (req, res) => {
    res.json(readConfig());
});

app.post('/api/config', (req, res) => {
    const config = readConfig();
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
    writeConfig(config);
    res.json({ success: true, message: 'Config updated', config });
});

// External quick update APIs
app.get('/api/update-sfx', (req, res) => {
    const newVal = req.query.val;
    if (newVal !== undefined) {
        const config = readConfig();
        config.defSfxId = newVal;
        writeConfig(config);
        return res.json({ success: true, message: 'DefSfxId updated externally', defSfxId: config.defSfxId });
    }
    res.status(400).json({ success: false, message: 'Missing val parameter. Usage: /api/update-sfx?val=NEW_VALUE' });
});

app.get('/api/update-bcd-api-val', (req, res) => {
    const newVal = req.query.val;
    if (newVal !== undefined) {
        const config = readConfig();
        config.bcdAPIVal = newVal;
        writeConfig(config);
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
