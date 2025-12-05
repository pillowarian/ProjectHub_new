const API_BASE_URL = `${window.location.origin}/api`;

// Load auth manager
let authManager;
try {
    authManager = window.authManager;
} catch (e) {
    authManager = {
        getToken: () => localStorage.getItem('ProjectHub_token'),
        getUserData: () => {
            const data = localStorage.getItem('ProjectHub_user');
            return data ? JSON.parse(data) : null;
        },
        logout: () => {
            localStorage.removeItem('ProjectHub_token');
            localStorage.removeItem('ProjectHub_user');
            localStorage.removeItem('userId');
        },
        authenticatedFetch: async (url, options = {}) => {
            const token = authManager.getToken();
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
            const response = await fetch(url, config);
            if (response.status === 401) {
                authManager.logout();
                window.location.href = '/auth/login.html';
            }
            return response;
        }
    };
}

// Get elements
const loadingState = document.getElementById('loadingState');
const form = document.getElementById('editProfileForm');
const updateBtn = document.getElementById('updateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const btnText = updateBtn.querySelector('.btn-text');
const spinner = updateBtn.querySelector('.spinner');
const alertMessage = document.getElementById('alertMessage');
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');

// Profile info display elements
const displayUserId = document.getElementById('displayUserId');
const displayTotalProjects = document.getElementById('displayTotalProjects');
const displayCreatedAt = document.getElementById('displayCreatedAt');

// Form fields
const fields = {
    username: document.getElementById('username'),
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    position: document.getElementById('position'),
    phone: document.getElementById('phone'),
    organization: document.getElementById('organization'),
    github_url: document.getElementById('github_url'),
    linkedin_url: document.getElementById('linkedin_url')
};

let userId = null;
let originalData = {};
let modifiedFields = new Set();

// Get user ID from JWT token or URL
function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    
    if (urlUserId) return urlUserId;
    
    // Get from JWT token
    const userData = authManager.getUserData();
    if (userData) return userData.userId;
    
    // Legacy fallback
    return localStorage.getItem('userId');
}

// Load profile data
async function loadProfile() {
    userId = getUserId();
    
    if (!userId) {
        showAlert('No user ID found. Please login first.', 'error');
        setTimeout(() => {
            window.location.href = '/auth/login.html';
        }, 2000);
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            originalData = data.data;
            populateForm(data.data);
            loadingState.style.display = 'none';
            form.style.display = 'block';
        } else {
            if (response.status === 404) {
                showAlert('Profile not found. Please create a new profile.', 'error');
                setTimeout(() => {
                    window.location.href = 'create-profile.html';
                }, 2000);
            } else {
                showAlert('Failed to load profile. Please try again.', 'error');
            }
            loadingState.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('Network error. Please check your connection.', 'error');
        loadingState.style.display = 'none';
    }
}

// Populate form with profile data
function populateForm(data) {
    // Display profile info
    displayUserId.textContent = data.id;
    displayTotalProjects.textContent = data.total_projects;
    displayCreatedAt.textContent = new Date(data.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Populate form fields
    fields.username.value = data.username || '';
    fields.name.value = data.name || '';
    fields.email.value = data.email || '';
    fields.position.value = data.position || 'student';
    fields.phone.value = data.phone || '';
    fields.organization.value = data.organization || '';
    fields.github_url.value = data.github_url || '';
    fields.linkedin_url.value = data.linkedin_url || '';
    fields.password.value = ''; // Never populate password
}

// Track field changes
Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    
    field.addEventListener('input', () => {
        if (fieldName === 'password') {
            // Password is always considered modified if it has a value
            if (field.value) {
                modifiedFields.add(fieldName);
                field.classList.add('modified');
            } else {
                modifiedFields.delete(fieldName);
                field.classList.remove('modified');
            }
        } else {
            const originalValue = originalData[fieldName] || '';
            const currentValue = field.value;
            
            if (currentValue !== originalValue) {
                modifiedFields.add(fieldName);
                field.classList.add('modified');
            } else {
                modifiedFields.delete(fieldName);
                field.classList.remove('modified');
            }
        }
        
        // Update button text based on modified fields
        if (modifiedFields.size > 0) {
            btnText.textContent = `Update Profile (${modifiedFields.size} field${modifiedFields.size > 1 ? 's' : ''} changed)`;
        } else {
            btnText.textContent = 'Update Profile';
        }
    });
});

// Validation function
function validateField(fieldName, field) {
    const value = field.value.trim();
    let errorMessage = '';
    
    if (value) {
        switch (fieldName) {
            case 'username':
                if (value.length < 3) {
                    errorMessage = 'Username must be at least 3 characters';
                } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                    errorMessage = 'Username can only contain letters, numbers, and underscores';
                }
                break;
                
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errorMessage = 'Please enter a valid email address';
                }
                break;
                
            case 'password':
                if (value && value.length < 6) {
                    errorMessage = 'Password must be at least 6 characters';
                }
                break;
                
            case 'phone':
                if (value && !/^[0-9+\-\s()]+$/.test(value)) {
                    errorMessage = 'Please enter a valid phone number';
                }
                break;
                
            case 'github_url':
            case 'linkedin_url':
                if (value && !isValidURL(value)) {
                    errorMessage = 'Please enter a valid URL';
                }
                break;
        }
    }
    
    const errorSpan = document.getElementById(`${fieldName}-error`);
    if (errorSpan) {
        errorSpan.textContent = errorMessage;
    }
    
    return !errorMessage;
}

// URL validation helper
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Show alert message
function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            alertMessage.style.display = 'none';
        }, 5000);
    }
    
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (modifiedFields.size === 0) {
        showAlert('No changes to update', 'error');
        return;
    }
    
    // Validate modified fields
    let isValid = true;
    modifiedFields.forEach(fieldName => {
        if (!validateField(fieldName, fields[fieldName])) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showAlert('Please fix the errors before updating', 'error');
        return;
    }
    
    // Prepare update data (only modified fields)
    const updateData = {};
    modifiedFields.forEach(fieldName => {
        const value = fields[fieldName].value.trim();
        if (fieldName === 'password') {
            if (value) {
                updateData[fieldName] = value;
            }
        } else {
            updateData[fieldName] = value || null;
        }
    });
    
    // Show loading state
    updateBtn.disabled = true;
    btnText.textContent = 'Updating...';
    spinner.style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Profile updated successfully!', 'success');
            
            // Reload profile data
            await loadProfile();
            
            // Clear modified fields
            modifiedFields.clear();
            Object.values(fields).forEach(field => field.classList.remove('modified'));
            btnText.textContent = 'Update Profile';
        } else {
            if (response.status === 409) {
                showAlert('Username or email already exists.', 'error');
            } else {
                showAlert(data.message || 'Failed to update profile.', 'error');
            }
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        updateBtn.disabled = false;
        spinner.style.display = 'none';
    }
});

// Delete account handlers
deleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('active');
});

cancelDelete.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});

confirmDelete.addEventListener('click', async () => {
    const deleteSpinner = confirmDelete.querySelector('.spinner');
    const deleteBtnText = confirmDelete.querySelector('.btn-text');
    
    confirmDelete.disabled = true;
    deleteBtnText.textContent = 'Deleting...';
    deleteSpinner.style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            authManager.logout();
            alert('Account deleted successfully. You will be redirected to login.');
            window.location.href = '/auth/login.html';
        } else {
            alert('Failed to delete account: ' + (data.message || 'Unknown error'));
            deleteModal.classList.remove('active');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Network error. Please try again.');
        deleteModal.classList.remove('active');
    } finally {
        confirmDelete.disabled = false;
        deleteBtnText.textContent = 'Yes, Delete My Account';
        deleteSpinner.style.display = 'none';
    }
});

// Close modal when clicking outside
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.remove('active');
    }
});

// Load profile on page load
loadProfile();
