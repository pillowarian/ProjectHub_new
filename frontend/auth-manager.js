// JWT Authentication utilities for ProjecTra
class AuthManager {
    constructor() {
        this.TOKEN_KEY = 'ProjecTra_token';
        this.USER_KEY = 'ProjecTra_user';
        this.API_BASE_URL = `${window.location.origin}/api`;
    }

    // Store token and user data
    setAuthData(token, userData) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    }

    // Get stored token
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    // Get stored user data
    getUserData() {
        const userData = localStorage.getItem(this.USER_KEY);
        return userData ? JSON.parse(userData) : null;
    }

    // Check if user is logged in
    isLoggedIn() {
        return !!this.getToken();
    }

    // Clear auth data (logout)
    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        // Also remove legacy userId if exists
        localStorage.removeItem('userId');
    }

    // Make authenticated API request
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            }
        };

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Check if token expired
            if (response.status === 401) {
                const data = await response.json();
                if (data.expired) {
                    this.logout();
                    window.location.href = '/auth/login.html';
                    return;
                }
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Verify token with server
    async verifyToken() {
        if (!this.getToken()) {
            return false;
        }

        try {
            const response = await this.authenticatedFetch(`${this.API_BASE_URL}/verify`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Update user data in case it changed
                    this.setAuthData(this.getToken(), data.data);
                    return true;
                }
            }
            
            // Token is invalid, logout
            this.logout();
            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
            return false;
        }
    }

    // Login method
    async login(emailOrUsername, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailOrUsername,
                    password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.setAuthData(data.token, data.data);
                return { success: true, data: data.data };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Register method
    async register(userData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.setAuthData(data.token, data.data);
                return { success: true, data: data.data };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Initialize auth on page load
    async initializeAuth() {
        if (this.isLoggedIn()) {
            const isValid = await this.verifyToken();
            return isValid;
        }
        return false;
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = '/auth/login.html';
            return false;
        }
        return true;
    }

    // Migrate legacy localStorage userId to new token system
    migrateLegacyAuth() {
        const legacyUserId = localStorage.getItem('userId');
        if (legacyUserId && !this.getToken()) {
            // User was logged in with old system, redirect to login
            localStorage.removeItem('userId');
            window.location.href = '/auth/login.html';
        }
    }
}

// Create global auth manager instance
window.authManager = new AuthManager();