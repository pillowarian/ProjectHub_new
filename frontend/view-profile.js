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
            return fetch(url, config);
        }
    };
}

// Get elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const profileContent = document.getElementById('profileContent');
const editProfileBtn = document.getElementById('editProfileBtn');
const followBtn = document.getElementById('followBtn');
const messageBtn = document.getElementById('messageBtn');
const followText = document.getElementById('followText');

// Profile elements
const avatarInitials = document.getElementById('avatarInitials');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const positionBadge = document.getElementById('positionBadge');
const organizationBadge = document.getElementById('organizationBadge');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileOrganization = document.getElementById('profileOrganization');
const totalProjects = document.getElementById('totalProjects');
const memberSince = document.getElementById('memberSince');
const userId = document.getElementById('userId');

// Sections
const phoneSection = document.getElementById('phoneSection');
const organizationSection = document.getElementById('organizationSection');
const socialSection = document.getElementById('socialSection');
const githubLink = document.getElementById('githubLink');
const linkedinLink = document.getElementById('linkedinLink');

// Projects elements
const projectCount = document.getElementById('projectCount');
const projectsLoading = document.getElementById('projectsLoading');
const noProjects = document.getElementById('noProjects');
const projectsGrid = document.getElementById('projectsGrid');

let currentUserId = null;
let loggedInUserId = null;
let isOwnProfile = false;

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

// Get initials from name
function getInitials(name) {
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format member since date
function formatMemberSince(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    });
}

// Load profile data
async function loadProfile() {
    currentUserId = getUserId();
    const userData = authManager.getUserData();
    loggedInUserId = userData ? userData.userId : null;
    isOwnProfile = loggedInUserId && loggedInUserId.toString() === currentUserId.toString();
    
    if (!currentUserId) {
        showError();
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${currentUserId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayProfile(data.data);
            loadProjects();
            
            // Setup follow/message buttons
            if (!isOwnProfile && loggedInUserId && data.data.organization) {
                setupFollowMessage(data.data);
            }
        } else {
            showError();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showError();
    }
}

// Setup follow and message buttons
async function setupFollowMessage(profile) {
    followBtn.style.display = 'flex';
    messageBtn.style.display = 'flex';
    editProfileBtn.style.display = 'none';
    
    // Check if already following
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/users/${currentUserId}/is-following`
        );
        
        if (response.ok) {
            const data = await response.json();
            updateFollowButton(data.isFollowing);
        }
    } catch (error) {
        console.error('Error checking follow status:', error);
    }
    
    // Follow button handler
    followBtn.addEventListener('click', async () => {
        try {
            const isFollowing = followBtn.dataset.following === 'true';
            const endpoint = isFollowing ? 'unfollow' : 'follow';
            const url = `${API_BASE_URL}/users/${currentUserId}/${endpoint}`;
            
            const response = await authManager.authenticatedFetch(url, {
                method: 'POST'
            });
            
            if (response.ok) {
                updateFollowButton(!isFollowing);
            } else {
                alert('Error updating follow status');
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            alert('Error toggling follow');
        }
    });
    
    // Message button handler
    messageBtn.addEventListener('click', () => {
        // Navigate to messages page with the user selected
        window.location.href = `messages.html?userId=${currentUserId}`;
    });
}

function updateFollowButton(isFollowing) {
    followBtn.dataset.following = isFollowing;
    if (isFollowing) {
        followText.textContent = 'Following';
        followBtn.classList.add('following');
    } else {
        followText.textContent = 'Follow';
        followBtn.classList.remove('following');
    }
}

// Display profile data
function displayProfile(profile) {
    // Hide loading, show content
    loadingState.style.display = 'none';
    profileContent.style.display = 'block';
    
    // Set avatar initials
    avatarInitials.textContent = getInitials(profile.name);
    
    // Set profile info
    profileName.textContent = profile.name;
    profileUsername.textContent = profile.username;
    positionBadge.textContent = profile.position;
    
    // Set stats
    totalProjects.textContent = profile.total_projects || 0;
    memberSince.textContent = formatMemberSince(profile.created_at);
    userId.textContent = `#${profile.id}`;
    
    // Set contact info
    profileEmail.textContent = profile.email;
    
    // Phone (optional)
    if (profile.phone) {
        profilePhone.textContent = profile.phone;
        phoneSection.style.display = 'flex';
    }
    
    // Organization (optional)
    if (profile.organization) {
        profileOrganization.textContent = profile.organization;
        organizationSection.style.display = 'flex';
        organizationBadge.textContent = profile.organization;
    } else {
        organizationBadge.style.display = 'none';
    }
    
    // Social links (optional)
    let hasSocialLinks = false;
    
    if (profile.github_url) {
        githubLink.href = profile.github_url;
        githubLink.style.display = 'flex';
        hasSocialLinks = true;
    }
    
    if (profile.linkedin_url) {
        linkedinLink.href = profile.linkedin_url;
        linkedinLink.style.display = 'flex';
        hasSocialLinks = true;
    }
    
    if (hasSocialLinks) {
        socialSection.style.display = 'block';
    }
    
    // Show edit button only if own profile
    if (isOwnProfile) {
        editProfileBtn.style.display = 'flex';
        editProfileBtn.addEventListener('click', () => {
            window.location.href = 'edit-profile.html';
        });
    }
}

// Load user's projects
async function loadProjects() {
    projectsLoading.style.display = 'block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/user/${currentUserId}?limit=50`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayProjects(data.data);
        } else {
            projectsLoading.style.display = 'none';
            noProjects.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsLoading.style.display = 'none';
        noProjects.style.display = 'block';
    }
}

// Display projects
function displayProjects(projects) {
    projectsLoading.style.display = 'none';
    
    if (projects.length === 0) {
        noProjects.style.display = 'block';
        projectCount.textContent = '0 projects';
        return;
    }
    
    projectCount.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
    
    projects.forEach(project => {
        const projectCard = createProjectCard(project);
        projectsGrid.appendChild(projectCard);
    });
}

// Create project card
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    // Privacy badge
    const privacyClass = project.privacy || 'public';
    
    // Tags
    const tags = project.tags ? project.tags.split(',').map(tag => tag.trim()) : [];
    const tagsHTML = tags.slice(0, 5).map(tag => 
        `<span class="tag">${tag}</span>`
    ).join('');
    
    // Description (truncate if too long)
    const description = project.description 
        ? (project.description.length > 120 
            ? project.description.substring(0, 120) + '...' 
            : project.description)
        : 'No description provided';
    
    // Date
    const createdDate = formatDate(project.created_at);
    
    card.innerHTML = `
        <div class="project-header">
            <h3>${project.name}</h3>
            <span class="privacy-badge ${privacyClass}">${privacyClass}</span>
        </div>
        <p>${description}</p>
        ${tags.length > 0 ? `<div class="project-tags">${tagsHTML}</div>` : ''}
        <div class="project-meta">
            <span>👍 ${project.likes_count || 0} likes</span>
            <span>💬 ${project.comments_count || 0} comments</span>
            <span>📅 ${createdDate}</span>
        </div>
        ${project.link ? `<a href="${project.link}" class="project-link" target="_blank">View Project →</a>` : ''}
    `;
    
    // Add click handler to navigate to project view
    card.addEventListener('click', (e) => {
        // Don't navigate if clicking on external links
        if (e.target.tagName === 'A' && e.target.hasAttribute('href')) {
            return;
        }
        window.location.href = `/project-view.html?id=${project.id}`;
    });
    
    return card;
}

// Show error state
function showError() {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
}

// Edit profile button handler
editProfileBtn.addEventListener('click', () => {
    window.location.href = `edit-profile.html?userId=${currentUserId}`;
});

// Load profile on page load
loadProfile();
initializeNotifications();

// Notification System (same as home.js)
let notificationsLoaded = false;
let unreadCount = 0;

function initializeNotifications() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    // Toggle notifications dropdown
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const isOpen = notificationsDropdown.classList.contains('show');
            
            if (!isOpen) {
                notificationsDropdown.classList.add('show');
                if (!notificationsLoaded) {
                    loadNotifications();
                }
            } else {
                notificationsDropdown.classList.remove('show');
            }
        });
    }
    
    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications-menu')) {
            notificationsDropdown?.classList.remove('show');
        }
    });
    
    // Load initial notification count
    loadNotificationCount();
}

async function loadNotifications() {
    const loadingEl = document.getElementById('notificationsLoading');
    const listEl = document.getElementById('notificationsList');
    const emptyEl = document.getElementById('notificationsEmpty');
    
    try {
        loadingEl.style.display = 'flex';
        listEl.style.display = 'none';
        emptyEl.style.display = 'none';
        
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications?limit=20`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayNotifications(data.data);
            updateNotificationBadge(data.unread_count);
            notificationsLoaded = true;
        } else {
            throw new Error(data.message || 'Failed to load notifications');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load notifications</div>';
    } finally {
        loadingEl.style.display = 'none';
        listEl.style.display = 'block';
    }
}

function displayNotifications(notifications) {
    const listEl = document.getElementById('notificationsList');
    const emptyEl = document.getElementById('notificationsEmpty');
    
    if (notifications.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }
    
    listEl.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationEl = createNotificationElement(notification);
        listEl.appendChild(notificationEl);
    });
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${!notification.is_read ? 'unread' : ''}`;
    div.dataset.notificationId = notification.id;
    
    // Determine icon based on type
    let iconContent = '📄';
    let iconClass = 'organization_project';
    
    switch (notification.type) {
        case 'like':
            iconContent = '❤️';
            iconClass = 'like';
            break;
        case 'comment':
            iconContent = '💬';
            iconClass = 'comment';
            break;
        case 'new_project_org':
            iconContent = '🏢';
            iconClass = 'organization_project';
            break;
        case 'organization_project':
            iconContent = '🏢';
            iconClass = 'organization_project';
            break;
    }
    
    div.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon ${iconClass}">
                ${iconContent}
            </div>
            <div class="notification-text">
                <div class="notification-title">${escapeHtml(notification.title)}</div>
                <div class="notification-message">${escapeHtml(notification.message)}</div>
                <div class="notification-time">${formatRelativeTime(notification.created_at)}</div>
            </div>
        </div>
    `;
    
    // Add click handler to navigate to project and mark as read
    div.addEventListener('click', () => {
        if (notification.project_id) {
            // Mark as read if unread
            if (!notification.is_read) {
                markNotificationAsRead(notification.id);
            }
            
            // Navigate to project
            window.location.href = `/project-view.html?id=${notification.project_id}`;
        }
    });
    
    return div;
}

async function loadNotificationCount() {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/count`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateNotificationBadge(data.unread_count);
        }
    } catch (error) {
        console.error('Error loading notification count:', error);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    unreadCount = count;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/read`, {
            method: 'PATCH',
            body: JSON.stringify({
                notification_ids: [notificationId]
            })
        });
        
        if (response.ok) {
            // Update UI
            const notificationEl = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (notificationEl) {
                notificationEl.classList.remove('unread');
            }
            
            // Update badge
            if (unreadCount > 0) {
                updateNotificationBadge(unreadCount - 1);
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/read`, {
            method: 'PATCH',
            body: JSON.stringify({
                notification_ids: 'all'
            })
        });
        
        if (response.ok) {
            // Update UI - remove unread class from all notifications
            document.querySelectorAll('.notification-item.unread').forEach(el => {
                el.classList.remove('unread');
            });
            
            // Update badge
            updateNotificationBadge(0);
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function formatRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now - date;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
