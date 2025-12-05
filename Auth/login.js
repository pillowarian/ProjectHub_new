const API_BASE_URL = `${window.location.origin}/api`;

// Initialize auth manager
const authManager = window.authManager || new (class {
    constructor() {
        this.TOKEN_KEY = 'ProjectHub_token';
        this.USER_KEY = 'ProjectHub_user';
    }
    setAuthData(token, userData) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    }
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }
    getUserData() {
        const userData = localStorage.getItem(this.USER_KEY);
        return userData ? JSON.parse(userData) : null;
    }
    isLoggedIn() {
        return !!this.getToken();
    }
    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem('userId');
    }
    async login(emailOrUsername, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailOrUsername, password })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                this.setAuthData(data.token, data.data);
                return { success: true, data: data.data };
            }
            return { success: false, message: data.message };
        } catch (error) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }
    async register(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                this.setAuthData(data.token, data.data);
                return { success: true, data: data.data };
            }
            return { success: false, message: data.message };
        } catch (error) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }
})();

// Get elements
const loginForm = document.querySelector('#loginForm form');
const registerForm = document.querySelector('#registerForm form');
const loginFormContainer = document.getElementById('loginForm');
const registerFormContainer = document.getElementById('registerForm');
const registerLink = document.getElementById('registerLink');
const backToLoginLink = document.getElementById('backToLogin');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailOrPhone = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // Clear previous error
    loginError.textContent = '';
    
    // Validate input
    if (!emailOrPhone || !password) {
        loginError.textContent = 'Please enter email/username and password';
        return;
    }
    
    // Disable button during login
    const loginBtn = loginForm.querySelector('.login-btn');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    
    try {
        const result = await authManager.login(emailOrPhone, password);
        
        if (result.success) {
            // Redirect to home page
            window.location.href = '/home.html';
        } else {
            loginError.textContent = result.message;
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Network error. Please try again.';
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
});

// Register form submission
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('mail').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const organization = document.getElementById('institute').value.trim();
        const position = document.getElementById('position').value.trim().toLowerCase();
        
        // Clear previous error
        registerError.textContent = '';
        
        // Validate inputs
        if (!name || !email || !password || !organization || !position) {
            registerError.textContent = 'All fields are required';
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            registerError.textContent = 'Please enter a valid email address';
            return;
        }
        
        // Validate password length
        if (password.length < 6) {
            registerError.textContent = 'Password must be at least 6 characters';
            return;
        }
        
        // Validate position
        const validPositions = ['student', 'teacher', 'other'];
        if (!validPositions.includes(position)) {
            registerError.textContent = 'Position must be: student, teacher, or other';
            return;
        }
        
        // Generate username from email
        const username = email.split('@')[0];
        
        // Disable button during registration
        const registerBtn = registerForm.querySelector('.login-btn');
        const originalText = registerBtn.textContent;
        registerBtn.textContent = 'Creating Account...';
        registerBtn.disabled = true;
        
        try {
            const result = await authManager.register({
                username: username,
                name: name,
                email: email,
                password: password,
                position: position,
                organization: organization
            });
            
            if (result.success) {
                // Show success message
                registerError.style.color = '#28a745';
                registerError.textContent = 'Account created successfully! Redirecting...';
                
                // Redirect to home page after 1.5 seconds
                setTimeout(() => {
                    window.location.href = '/home.html';
                }, 1500);
            } else {
                registerError.textContent = result.message || 'Failed to create account';
            }
        } catch (error) {
            console.error('Registration error:', error);
            registerError.textContent = 'Network error. Please try again.';
        } finally {
            registerBtn.textContent = originalText;
            registerBtn.disabled = false;
        }
    });
}

// Toggle between login and register forms
if (registerLink && registerFormContainer) {
    registerLink.addEventListener('click', (e) => {
        // If using a dedicated create profile page, let the link navigate
        if (registerLink.getAttribute('href') === '/create-profile.html') return;
        e.preventDefault();
        if (loginFormContainer) loginFormContainer.style.display = 'none';
        registerFormContainer.style.display = 'block';
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
    });
}

if (backToLoginLink && registerFormContainer) {
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.style.display = 'none';
        if (loginFormContainer) loginFormContainer.style.display = 'block';
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
    });
}

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    // Migrate legacy auth if needed
    const legacyUserId = localStorage.getItem('userId');
    if (legacyUserId && !authManager.getToken()) {
        localStorage.removeItem('userId');
    }
    
    // Check if already logged in
    if (authManager.isLoggedIn()) {
        // User is already logged in, redirect to home
        window.location.href = '/home.html';
    }
});
