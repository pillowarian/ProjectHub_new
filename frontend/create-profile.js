const API_BASE_URL = `${window.location.origin}/api`;

// Load auth manager
let authManager;
try {
    authManager = window.authManager;
} catch (e) {
    authManager = {
        setAuthData: (token, userData) => {
            localStorage.setItem('ProjecTra_token', token);
            localStorage.setItem('ProjecTra_user', JSON.stringify(userData));
        }
    };
}

// Get form and elements
const form = document.getElementById('createProfileForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.querySelector('.btn-text');
const spinner = document.querySelector('.spinner');
const alertMessage = document.getElementById('alertMessage');

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

// Real-time validation
Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    const errorSpan = document.getElementById(`${fieldName}-error`);
    
    field.addEventListener('blur', () => {
        validateField(fieldName, field, errorSpan);
    });
    
    field.addEventListener('input', () => {
        if (errorSpan && errorSpan.textContent) {
            validateField(fieldName, field, errorSpan);
        }
    });
});

// Validation function
function validateField(fieldName, field, errorSpan) {
    const value = field.value.trim();
    let errorMessage = '';
    
    // Required field validation
    const requiredFields = ['username', 'name', 'email', 'password', 'position'];
    if (requiredFields.includes(fieldName) && !value) {
        errorMessage = 'This field is required';
        field.classList.add('invalid');
        field.classList.remove('valid');
    } else if (value) {
        // Specific validations
        switch (fieldName) {
            case 'username':
                if (value.length < 3) {
                    errorMessage = 'Username must be at least 3 characters';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                    errorMessage = 'Username can only contain letters, numbers, and underscores';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
                break;
                
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errorMessage = 'Please enter a valid email address';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
                break;
                
            case 'password':
                if (value.length < 6) {
                    errorMessage = 'Password must be at least 6 characters';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
                break;
                
            case 'phone':
                if (value && !/^[0-9+\-\s()]+$/.test(value)) {
                    errorMessage = 'Please enter a valid phone number';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else if (value) {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
                break;
                
            case 'github_url':
            case 'linkedin_url':
                if (value && !isValidURL(value)) {
                    errorMessage = 'Please enter a valid URL';
                    field.classList.add('invalid');
                    field.classList.remove('valid');
                } else if (value) {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
                break;
                
            default:
                if (value) {
                    field.classList.remove('invalid');
                    field.classList.add('valid');
                }
        }
    } else {
        field.classList.remove('invalid');
        field.classList.remove('valid');
    }
    
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
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            alertMessage.style.display = 'none';
        }, 5000);
    }
    
    // Scroll to alert
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate all required fields
    let isValid = true;
    const requiredFields = ['username', 'name', 'email', 'password', 'position'];
    
    requiredFields.forEach(fieldName => {
        const field = fields[fieldName];
        const errorSpan = document.getElementById(`${fieldName}-error`);
        if (!validateField(fieldName, field, errorSpan)) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showAlert('Please fix the errors before submitting', 'error');
        return;
    }
    
    // Prepare form data
    const formData = {
        username: fields.username.value.trim(),
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        password: fields.password.value,
        position: fields.position.value
    };
    
    // Add optional fields if they have values
    if (fields.phone.value.trim()) {
        formData.phone = fields.phone.value.trim();
    }
    if (fields.organization.value.trim()) {
        formData.organization = fields.organization.value.trim();
    }
    if (fields.github_url.value.trim()) {
        formData.github_url = fields.github_url.value.trim();
    }
    if (fields.linkedin_url.value.trim()) {
        formData.linkedin_url = fields.linkedin_url.value.trim();
    }
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.textContent = 'Creating Profile...';
    spinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Profile created successfully! Redirecting...', 'success');
            
            // Store JWT token and user data
            if (data.token && data.data) {
                authManager.setAuthData(data.token, data.data);
            } else {
                // Fallback for legacy format
                localStorage.setItem('userId', data.data.userId);
            }
            
            // Redirect after 2 seconds
            setTimeout(() => {
                window.location.href = '/home.html';
            }, 2000);
        } else {
            // Handle specific error messages
            if (response.status === 409) {
                showAlert('Username or email already exists. Please use different credentials.', 'error');
            } else if (response.status === 400) {
                showAlert(data.message || 'Please check your input and try again.', 'error');
            } else {
                showAlert(data.message || 'Failed to create profile. Please try again.', 'error');
            }
            
            // Reset button
            submitBtn.disabled = false;
            btnText.textContent = 'Create Profile';
            spinner.style.display = 'none';
        }
    } catch (error) {
        console.error('Error creating profile:', error);
        showAlert('Network error. Please check your connection and try again.', 'error');
        
        // Reset button
        submitBtn.disabled = false;
        btnText.textContent = 'Create Profile';
        spinner.style.display = 'none';
    }
});

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    if (authManager.getToken && authManager.getToken()) {
        // User is already logged in, redirect to home
        window.location.href = '/home.html';
    } else if (localStorage.getItem('userId')) {
        // Legacy auth, redirect to login
        localStorage.removeItem('userId');
        window.location.href = '/auth/login.html';
    }
});
