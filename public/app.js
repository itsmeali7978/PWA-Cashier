document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    // Login
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    // Barcode & App
    const logoutBtn = document.getElementById('logout-btn');
    const generateBtn = document.getElementById('generate-btn');
    const barcodePlaceholder = document.getElementById('barcode-placeholder');
    const barcodeContainer = document.getElementById('barcode-container');
    const bcdValueDisplay = document.getElementById('bcd-value-display');
    const genMsg = document.getElementById('gen-msg');
    
    // Timer
    const timeLeftEl = document.getElementById('time-left');
    const timerBar = document.getElementById('timer-bar');
    let timerInterval;
    
    // Admin Collapse
    const adminPanelHeader = document.getElementById('admin-panel-header');
    const adminPanelContent = document.getElementById('admin-panel-content');
    if (adminPanelHeader) {
        adminPanelHeader.addEventListener('click', () => {
            const isHidden = adminPanelContent.classList.contains('hidden');
            adminPanelContent.classList.toggle('hidden');
            adminPanelHeader.querySelector('span').textContent = isHidden ? '▲' : '▼';
            if (isHidden) loadUserManagement();
        });
    }
    
    // Admin
    const showCreateUserBtn = document.getElementById('show-create-user-btn');
    const showChangePassBtn = document.getElementById('show-change-pass-btn');
    const createUserForm = document.getElementById('create-user-form');
    const changePassForm = document.getElementById('change-pass-form');
    const prefixIdInput = document.getElementById('prefix-id-input');
    const defaultToggle = document.getElementById('default-toggle');
    const defPrfxInput = document.getElementById('def-prfx-input');
    const defSfxInput = document.getElementById('def-sfx-input');
    const bcdAPIValInput = document.getElementById('bcd-api-val-input');
    const userListContainer = document.getElementById('user-list-container');
    const setupShowBcd = document.getElementById('setup-show-bcd');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const configMsg = document.getElementById('config-msg');
    
    let appConfig = { prefixId: '', isDefault: false, defPrfxId: '', defSfxId: '', bcdAPIVal: '' };
    
    async function fetchConfig() {
        try {
            const res = await fetch('/api/config');
            appConfig = await res.json();
            prefixIdInput.value = appConfig.prefixId || '';
            defaultToggle.checked = appConfig.isDefault || false;
            defPrfxInput.value = appConfig.defPrfxId || '';
            defSfxInput.value = appConfig.defSfxId || '';
            bcdAPIValInput.value = appConfig.bcdAPIVal || '';
        } catch(e) {}
    }
    fetchConfig();
    
    // Check if already logged in
    const authUser = localStorage.getItem('auth_user');
    if (authUser) {
        showScreen('app');
        toggleAdminPanel(authUser);
    }

    function toggleAdminPanel(username) {
        const adminPanel = document.querySelector('.admin-panel');
        if (username === 'admin') {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }
    }

    // Screen navigation
    function showScreen(screen) {
        if (screen === 'login') {
            appScreen.classList.remove('view-active');
            appScreen.classList.add('view-hidden');
            setTimeout(() => {
                appScreen.style.display = 'none';
                loginScreen.style.display = 'block';
                setTimeout(() => {
                    loginScreen.classList.remove('view-hidden');
                    loginScreen.classList.add('view-active');
                }, 10);
            }, 400);
        } else {
            loginScreen.classList.remove('view-active');
            loginScreen.classList.add('view-hidden');
            setTimeout(() => {
                loginScreen.style.display = 'none';
                appScreen.style.display = 'block';
                setTimeout(() => {
                    appScreen.classList.remove('view-hidden');
                    appScreen.classList.add('view-active');
                }, 10);
            }, 400);
        }
    }

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');
        
        btn.innerHTML = 'Signing in...';
        btn.disabled = true;
        loginError.textContent = '';
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('auth_user', data.username);
                localStorage.setItem('show_bcd_val', data.showBcdValue);
                loginForm.reset();
                showScreen('app');
                toggleAdminPanel(data.username);
            } else {
                loginScreen.querySelector('.glass-panel').classList.add('shake');
                setTimeout(() => loginScreen.querySelector('.glass-panel').classList.remove('shake'), 300);
                loginError.textContent = data.message;
            }
        } catch (err) {
            loginError.textContent = 'Server error. Please try again.';
        } finally {
            btn.innerHTML = 'Login';
            btn.disabled = false;
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('show_bcd_val');
        clearInterval(timerInterval);
        resetBarcodeView();
        showScreen('login');
    });

    // Generate Barcode
    generateBtn.addEventListener('click', async () => {
        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;
        genMsg.textContent = '';
        genMsg.style.color = 'var(--success)';
        
        try {
            const res = await fetch('/api/config');
            appConfig = await res.json();
            
            // Sync UI
            prefixIdInput.value = appConfig.prefixId || '';
            defaultToggle.checked = appConfig.isDefault || false;
            defPrfxInput.value = appConfig.defPrfxId || '';
            defSfxInput.value = appConfig.defSfxId || '';
            bcdAPIValInput.value = appConfig.bcdAPIVal || '';

            const renderBarcode = (val) => {
                JsBarcode("#barcode", val, {
                    displayValue: false,
                    lineColor: "#000",
                    background: "white",
                    width: 3,
                    height: 80,
                    margin: 0
                });
                startTimer();
            };

            if (appConfig.isDefault) {
                const defP = appConfig.defPrfxId || '';
                const defS = appConfig.defSfxId || '';
                const finalVal = `${defP}\t${defS}`;
                renderBarcode(finalVal);
                genMsg.textContent = 'Using default config values.';
                genMsg.style.color = '#ffb700';
            } else {
                const pre = appConfig.prefixId || '';
                const apiVal = appConfig.bcdAPIVal || '';
                const finalVal = `${pre}\t${apiVal}`;
                renderBarcode(finalVal);
             
                // Show value below barcode if enabled for this user
                const shouldShow = localStorage.getItem('show_bcd_val') === 'true';
                if (shouldShow) {
                    bcdValueDisplay.textContent = apiVal;
                    bcdValueDisplay.classList.remove('hidden');
                } else {
                    bcdValueDisplay.classList.add('hidden');
                }
            }
        } catch(e) {
            console.error('Generation Error:', e);
            genMsg.textContent = 'Error syncing config. Try again.';
            genMsg.style.color = 'var(--danger)';
        } finally {
            generateBtn.textContent = 'Generate Barcode';
            generateBtn.disabled = false;
        }
    });

    function resetBarcodeView() {
        barcodePlaceholder.classList.remove('hidden');
        barcodeContainer.classList.add('hidden');
        generateBtn.classList.remove('hidden');
        generateBtn.textContent = 'Generate Barcode';
        generateBtn.disabled = false;
        genMsg.textContent = '';
        bcdValueDisplay.classList.add('hidden');
        bcdValueDisplay.textContent = '';
    }

    function startTimer() {
        clearInterval(timerInterval);
        barcodePlaceholder.classList.add('hidden');
        barcodeContainer.classList.remove('hidden');
        generateBtn.classList.add('hidden');
        
        // Timer logic
        let timeLeft = 10;
        timeLeftEl.textContent = timeLeft;
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        timerBar.className = 'timer-bar'; // reset colors
        
        // Force reflow
        void timerBar.offsetWidth;
        
        timerBar.style.transition = 'width 1s linear, background-color 0.3s ease';
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timeLeftEl.textContent = timeLeft;
            timerBar.style.width = `${(timeLeft / 10) * 100}%`;
            
            if (timeLeft <= 5) {
                timerBar.classList.add('warning');
            }
            if (timeLeft <= 3) {
                timerBar.classList.remove('warning');
                timerBar.classList.add('danger');
                document.querySelector('.barcode-card').classList.add('shake');
                setTimeout(() => document.querySelector('.barcode-card').classList.remove('shake'), 300);
            }
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                resetBarcodeView();
                genMsg.textContent = 'Barcode expired.';
                genMsg.style.color = 'var(--text-muted)';
            }
        }, 1000);
    }
    
    // Admin toggles
    showCreateUserBtn.addEventListener('click', () => {
        createUserForm.classList.toggle('hidden');
        changePassForm.classList.add('hidden');
    });
    
    showChangePassBtn.addEventListener('click', () => {
        changePassForm.classList.toggle('hidden');
        createUserForm.classList.add('hidden');
    });
    
    saveConfigBtn.addEventListener('click', async () => {
        appConfig.prefixId = prefixIdInput.value;
        appConfig.isDefault = defaultToggle.checked;
        appConfig.defPrfxId = defPrfxInput.value;
        appConfig.defSfxId = defSfxInput.value;
        appConfig.bcdAPIVal = bcdAPIValInput.value;
        saveConfigBtn.disabled = true;
        configMsg.textContent = 'Saving...';
        configMsg.style.color = 'var(--text-muted)';
        
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appConfig)
            });
            const data = await res.json();
            if (data.success) {
                configMsg.style.color = 'var(--success)';
                configMsg.textContent = 'Config saved!';
                setTimeout(() => configMsg.textContent = '', 2000);
            }
        } catch(err) {
            configMsg.style.color = 'var(--danger)';
            configMsg.textContent = 'Error saving config';
        } finally {
            saveConfigBtn.disabled = false;
        }
    });
    
    // Create User Form
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const showBcdValue = setupShowBcd.checked;
        const msgEl = document.getElementById('cu-msg');
        await adminAction('/api/users', 'POST', { username, password, showBcdValue }, msgEl, createUserForm);
        loadUserManagement();
    });
    
    // Change Password Form
    changePassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('cp-username').value;
        const newPassword = document.getElementById('cp-password').value;
        const msgEl = document.getElementById('cp-msg');
        await adminAction(`/api/users/${username}`, 'PUT', { newPassword }, msgEl, changePassForm);
    });
    
    async function adminAction(url, method, body, msgEl, form) {
        const btn = form.querySelector('button');
        msgEl.textContent = 'Processing...';
        msgEl.style.color = 'var(--text-muted)';
        btn.disabled = true;
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            
            if (data.success) {
                msgEl.style.color = 'var(--success)';
                msgEl.textContent = data.message;
                form.reset();
            } else {
                msgEl.style.color = 'var(--danger)';
                msgEl.textContent = data.message;
            }
        } catch (err) {
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = 'Error processing request';
        } finally {
            btn.disabled = false;
        }
    }

    // Screenshot Protection
    document.addEventListener('contextmenu', e => {
        if (e.target.tagName !== 'INPUT') e.preventDefault();
    });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.body.style.opacity = '0';
        } else {
            document.body.style.opacity = '1';
        }
    });

    window.addEventListener('blur', () => {
        document.body.style.opacity = '0';
    });

    window.addEventListener('focus', () => {
        document.body.style.opacity = '1';
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText('');
            alert('Screenshots are prohibited for security reasons.');
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) {
            document.body.style.opacity = '0';
            setTimeout(() => document.body.style.opacity = '1', 2000);
            navigator.clipboard.writeText('');
        }
    });

});
