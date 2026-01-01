const API_BASE_URL = `${window.location.origin}/api`;

// Load auth manager
let authManager;
try {
    // Try to load from separate file first
    authManager = window.authManager;
} catch (e) {
    // Fallback implementation
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
const userInitials = document.getElementById('userInitials');
const userName = document.getElementById('userName');
const userUsername = document.getElementById('userUsername');
const userMenuBtn = document.getElementById('userMenuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutBtn = document.getElementById('logoutBtn');

// Navigation buttons
const todoListBtn = document.getElementById('todoListBtn');
const messagesBtn = document.getElementById('messagesBtn');

// Create project elements
const createProjectBtn = document.getElementById('createProjectBtn');
const createProjectModal = document.getElementById('createProjectModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const createProjectForm = document.getElementById('createProjectForm');
const submitProjectBtn = document.getElementById('submitProjectBtn');
const projectAlert = document.getElementById('projectAlert');

// Collaborators elements
const collaboratorSearch = document.getElementById('collaboratorSearch');
const collaboratorsList = document.getElementById('collaboratorsList');
const collaboratorsSelected = document.getElementById('collaboratorsSelected');

// Projects elements
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const projectsGrid = document.getElementById('projectsGrid');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const organizationFilter = document.getElementById('organizationFilter');
const tagFilter = document.getElementById('tagFilter');
const clearFiltersBtn = document.getElementById('clearFilters');

let currentUserId = null;
let userOrganization = null;
let currentPage = 1;
let currentFilter = 'all';
let currentOrganization = '';
let currentTag = '';
let currentSearchQuery = '';
let isSearchMode = false;
let allProjects = [];
let selectedCollaborators = [];
let availableMembers = [];

// Get user ID
function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    
    if (urlUserId) return urlUserId;
    
    // Try JWT auth first
    const userData = authManager.getUserData();
    if (userData) return userData.userId;
    
    // Fallback to legacy storage
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

// Load user info
async function loadUserInfo() {
    currentUserId = getUserId();
    
    if (!currentUserId) {
        window.location.href = '/auth/login.html';
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${currentUserId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            const profile = data.data;
            userOrganization = profile.organization; // Store user's organization
            userInitials.textContent = getInitials(profile.name);
            userName.textContent = profile.name;
            userUsername.textContent = `@${profile.username}`;
        } else {
            console.error('Failed to load user info');
            // If profile fetch fails, might be authentication issue
            if (response.status === 401 || response.status === 404) {
                authManager.logout();
                window.location.href = '/auth/login.html';
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Toggle dropdown menu
userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenuBtn.classList.toggle('active');
    dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!userMenuBtn.contains(e.target)) {
        userMenuBtn.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    authManager.logout();
    window.location.href = '/auth/login.html';
});

// Navigation button handlers
todoListBtn.addEventListener('click', () => {
    window.location.href = 'todo-list.html';
});

messagesBtn.addEventListener('click', () => {
    window.location.href = 'messages.html';
});

// Open create project modal
createProjectBtn.addEventListener('click', async () => {
    createProjectModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Load available members for collaborators when modal opens
    if (userOrganization) {
        await loadAvailableMembers();
    }
});

// Close modal handlers
function closeModal() {
    createProjectModal.classList.remove('show');
    document.body.style.overflow = 'auto';
    createProjectForm.reset();
    projectAlert.style.display = 'none';
    selectedCollaborators = [];
    collaboratorsList.innerHTML = '';
    collaboratorsSelected.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
cancelProjectBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

// Show alert in modal
function showProjectAlert(message, type) {
    projectAlert.textContent = message;
    projectAlert.className = `alert ${type}`;
    projectAlert.style.display = 'block';
    projectAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Load available members for collaborators
async function loadAvailableMembers() {
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/users/organization/${encodeURIComponent(userOrganization)}/members`
        );
        
        if (response.ok) {
            const data = await response.json();
            availableMembers = data.data || [];
            displayAvailableMembers(availableMembers);
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

function displayAvailableMembers(members) {
    collaboratorsList.innerHTML = '';
    
    members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'collaborator-item';
        memberItem.innerHTML = `
            <div class="collaborator-checkbox">
                <input type="checkbox" class="member-checkbox" value="${member.id}" data-name="${member.name}">
            </div>
            <div class="collaborator-info">
                <span class="member-name">${escapeHtml(member.name)}</span>
                <span class="member-username">@${escapeHtml(member.username)}</span>
            </div>
        `;
        
        const checkbox = memberItem.querySelector('.member-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCollaborators.push({
                    id: parseInt(member.id),
                    name: member.name
                });
            } else {
                selectedCollaborators = selectedCollaborators.filter(c => c.id !== parseInt(member.id));
            }
            updateSelectedCollaboratorsDisplay();
        });
        
        collaboratorsList.appendChild(memberItem);
    });
}

function updateSelectedCollaboratorsDisplay() {
    collaboratorsSelected.innerHTML = '';
    
    selectedCollaborators.forEach(collab => {
        const tag = document.createElement('div');
        tag.className = 'collaborator-tag';
        tag.innerHTML = `
            <span>${escapeHtml(collab.name)}</span>
            <button type="button" class="remove-collab" data-id="${collab.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        tag.querySelector('.remove-collab').addEventListener('click', (e) => {
            e.preventDefault();
            const id = parseInt(e.currentTarget.dataset.id);
            selectedCollaborators = selectedCollaborators.filter(c => c.id !== id);
            const checkbox = collaboratorsList.querySelector(`input[value="${id}"]`);
            if (checkbox) checkbox.checked = false;
            updateSelectedCollaboratorsDisplay();
        });
        
        collaboratorsSelected.appendChild(tag);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Collaborator search
collaboratorSearch?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = availableMembers.filter(member =>
        member.name.toLowerCase().includes(searchTerm) ||
        member.username.toLowerCase().includes(searchTerm)
    );
    displayAvailableMembers(filtered);
});

// Create project form submission
createProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('projectName').value.trim(),
        description: document.getElementById('projectDescription').value.trim(),
        link: document.getElementById('projectLink').value.trim(),
        organization: document.getElementById('projectOrganization').value.trim(),
        tags: document.getElementById('projectTags').value.trim(),
        privacy: document.getElementById('projectPrivacy').value
    };
    
    // Show loading
    submitProjectBtn.disabled = true;
    submitProjectBtn.querySelector('.btn-text').textContent = 'Creating...';
    submitProjectBtn.querySelector('.spinner').style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const projectId = data.data.projectId;
            
            // Add collaborators if any are selected
            if (selectedCollaborators.length > 0) {
                for (const collaborator of selectedCollaborators) {
                    try {
                        await authManager.authenticatedFetch(
                            `${API_BASE_URL}/collaborators/project/${projectId}/add`,
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    userId: collaborator.id,
                                    role: 'collaborator'
                                })
                            }
                        );
                    } catch (error) {
                        console.error(`Error adding collaborator ${collaborator.name}:`, error);
                    }
                }
            }
            
            showProjectAlert('Project created successfully!', 'success');
            setTimeout(() => {
                closeModal();
                loadProjects(true);
            }, 1500);
        } else {
            showProjectAlert(data.message || 'Failed to create project', 'error');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        showProjectAlert('Network error. Please try again.', 'error');
    } finally {
        submitProjectBtn.disabled = false;
        submitProjectBtn.querySelector('.btn-text').textContent = 'Create Project';
        submitProjectBtn.querySelector('.spinner').style.display = 'none';
    }
});

// Load all projects
async function loadProjects(reset = false) {
    if (reset) {
        currentPage = 1;
        allProjects = [];
        projectsGrid.innerHTML = '';
    }
    
    loadingState.style.display = 'block';
    projectsGrid.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        // Build URL with filters
        let url = `${API_BASE_URL}/projects?page=${currentPage}&limit=12&privacy=${currentFilter === 'all' ? 'all' : currentFilter}`;
        
        if (currentUserId) {
            url += `&userId=${currentUserId}`;
        }
        
        if (currentFilter === 'organization' && userOrganization) {
            url += `&userOrganization=${encodeURIComponent(userOrganization)}`;
        }
        
        if (currentOrganization) {
            url += `&organization=${encodeURIComponent(currentOrganization)}`;
        }
        
        if (currentTag) {
            url += `&tag=${encodeURIComponent(currentTag)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            allProjects = allProjects.concat(data.data);
            displayProjects(data.data);
            
            if (data.data.length < 12) {
                loadMoreContainer.style.display = 'none';
            } else {
                loadMoreContainer.style.display = 'block';
            }
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        showEmptyState();
    } finally {
        loadingState.style.display = 'none';
    }
}

// Display projects
function displayProjects(projects) {
    if (allProjects.length === 0) {
        showEmptyState();
        return;
    }
    
    projectsGrid.style.display = 'grid';
    
    projects.forEach(project => {
        const card = createProjectCard(project);
        
        // Add click handler to navigate to project view
        card.addEventListener('click', (e) => {
            // Don't navigate if clicking on external links
            if (e.target.tagName === 'A' && e.target.hasAttribute('href')) {
                return;
            }
            window.location.href = `/project-view.html?id=${project.id}`;
        });
        
        projectsGrid.appendChild(card);
    });
}

// Create project card
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    const privacyClass = project.privacy || 'public';
    const tags = project.tags ? project.tags.split(',').map(t => t.trim()) : [];
    const description = project.description || 'No description provided';
    const truncatedDesc = description.length > 150 ? description.substring(0, 150) + '...' : description;
    
    const authorInitials = getInitials(project.user_name || 'User');
    const isLiked = project.user_liked > 0;
    const likesCount = project.likes_count || 0;
    const commentsCount = project.total_comments || project.comments_count || 0;
    
    card.innerHTML = `
        <div class="project-header">
            <h3>${project.name}</h3>
            <span class="privacy-badge ${privacyClass}">${privacyClass}</span>
        </div>
        
        <div class="project-author">
            <div class="author-avatar">${authorInitials}</div>
            <div class="author-info">
                <span class="author-name">${project.user_name || 'Unknown'}</span>
                <span class="author-username">@${project.username || 'user'}</span>
            </div>
        </div>
        
        <p class="project-description">${truncatedDesc}</p>
        
        ${tags.length > 0 ? `
            <div class="project-tags">
                ${tags.slice(0, 5).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        ` : ''}
        
        <div class="project-footer">
            <div class="project-stats">
                <button class="stat-btn like-btn ${isLiked ? 'liked' : ''}" data-project-id="${project.id}" data-liked="${isLiked}">
                    <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
                    <span class="like-count">${likesCount}</span>
                </button>
                <button class="stat-btn comment-btn" data-project-id="${project.id}">
                    💬 <span class="comment-count">${commentsCount}</span>
                </button>
            </div>
            ${project.link ? `<a href="${project.link}" class="project-link" target="_blank" onclick="event.stopPropagation()">View →</a>` : ''}
        </div>
    `;
    
    // Add event listeners for like and comment buttons
    const likeBtn = card.querySelector('.like-btn');
    const commentBtn = card.querySelector('.comment-btn');
    
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProjectLike(project.id, likeBtn);
    });
    
    commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Navigate to project view for commenting
        window.location.href = `/project-view.html?id=${project.id}#comments`;
    });
    
    return card;
}

// Toggle project like
async function toggleProjectLike(projectId, likeBtn) {
    if (!authManager.getToken()) {
        alert('Please log in to like projects');
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${projectId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const likeIcon = likeBtn.querySelector('.like-icon');
            const likeCount = likeBtn.querySelector('.like-count');
            
            if (data.data.liked) {
                likeBtn.classList.add('liked');
                likeIcon.textContent = '❤️';
                likeBtn.dataset.liked = 'true';
            } else {
                likeBtn.classList.remove('liked');
                likeIcon.textContent = '🤍';
                likeBtn.dataset.liked = 'false';
            }
            
            likeCount.textContent = data.data.likesCount;
        } else {
            alert(data.message || 'Failed to update like');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Network error. Please try again.');
    }
}

// Show empty state
function showEmptyState() {
    loadingState.style.display = 'none';
    projectsGrid.style.display = 'none';
    emptyState.style.display = 'block';
    loadMoreContainer.style.display = 'none';
}

// Load more button
loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    if (isSearchMode) {
        searchProjects();
    } else {
        loadProjects();
    }
});

// Filter tabs
filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        
        // Reset search when changing filters
        if (isSearchMode) {
            searchInput.value = '';
            searchInput.classList.remove('active');
            currentSearchQuery = '';
            isSearchMode = false;
            resetEmptyState();
        }
        
        // Reset and load projects
        loadProjects(true);
    });
});

// Load organizations for filter dropdown
async function loadOrganizations() {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/organizations`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            organizationFilter.innerHTML = '<option value="">All Organizations</option>';
            data.data.forEach(org => {
                const option = document.createElement('option');
                option.value = org;
                option.textContent = org;
                organizationFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

// Load tags for filter dropdown  
async function loadTags() {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/tags`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            tagFilter.innerHTML = '<option value="">All Tags</option>';
            data.data.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Organization filter change handler
organizationFilter.addEventListener('change', (e) => {
    currentOrganization = e.target.value;
    loadProjects(true);
});

// Tag filter change handler
tagFilter.addEventListener('change', (e) => {
    currentTag = e.target.value;
    loadProjects(true);
});

// Clear filters handler
clearFiltersBtn.addEventListener('click', () => {
    currentOrganization = '';
    currentTag = '';
    organizationFilter.value = '';
    tagFilter.value = '';
    
    // Reset search if active
    if (isSearchMode) {
        searchInput.value = '';
        searchInput.classList.remove('active');
        currentSearchQuery = '';
        isSearchMode = false;
        resetEmptyState();
    }
    
    loadProjects(true);
});

// Search functionality
function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm === '') {
        // If search is empty, reload normal projects
        currentSearchQuery = '';
        isSearchMode = false;
        searchInput.classList.remove('active');
        currentPage = 1;
        allProjects = [];
        resetEmptyState();
        loadProjects(true);
        return;
    }
    
    currentSearchQuery = searchTerm;
    isSearchMode = true;
    searchInput.classList.add('active');
    currentPage = 1;
    allProjects = [];
    searchProjects(true);
}

// Search projects via API
async function searchProjects(reset = false) {
    if (reset) {
        projectsGrid.innerHTML = '';
        allProjects = [];
        currentPage = 1;
    }
    
    loadingState.style.display = 'block';
    projectsGrid.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        let url = `${API_BASE_URL}/projects/search?q=${encodeURIComponent(currentSearchQuery)}&page=${currentPage}&limit=12&privacy=${currentFilter === 'all' ? 'public' : currentFilter}`;
        
        if (currentUserId) {
            url += `&userId=${currentUserId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (reset || currentPage === 1) {
                allProjects = data.data;
            } else {
                allProjects = allProjects.concat(data.data);
            }
            
            if (data.data.length === 0 && currentPage === 1) {
                showSearchEmptyState();
            } else {
                displayProjects(reset ? data.data : allProjects);
                
                // Show/hide load more button
                if (data.pagination && currentPage < data.pagination.totalPages) {
                    loadMoreContainer.style.display = 'block';
                } else {
                    loadMoreContainer.style.display = 'none';
                }
            }
        } else {
            showSearchEmptyState();
        }
    } catch (error) {
        console.error('Error searching projects:', error);
        showSearchEmptyState();
    } finally {
        loadingState.style.display = 'none';
    }
}

// Show search empty state
function showSearchEmptyState() {
    loadingState.style.display = 'none';
    projectsGrid.style.display = 'none';
    emptyState.style.display = 'block';
    loadMoreContainer.style.display = 'none';
    
    // Update empty state message for search
    const emptyTitle = emptyState.querySelector('h2');
    const emptyText = emptyState.querySelector('p');
    emptyTitle.textContent = 'No Results Found';
    emptyText.textContent = `No projects found for "${currentSearchQuery}". Try different keywords or browse all projects.`;
}

// Reset empty state message
function resetEmptyState() {
    const emptyTitle = emptyState.querySelector('h2');
    const emptyText = emptyState.querySelector('p');
    emptyTitle.textContent = 'No Projects Yet';
    emptyText.textContent = 'Be the first to create a project!';
}

// Search event listeners
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Add search button functionality
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
}

// Clear search when input is cleared
searchInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '' && isSearchMode) {
        searchInput.classList.remove('active');
        performSearch(); // This will reset to normal mode
    }
});

// Initialize
loadUserInfo();
loadProjects(true);
loadOrganizations();
loadTags();
initializeNotifications();

// Notification System
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
            
            // Close all dropdowns first
            document.querySelectorAll('.dropdown-menu, .notifications-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
            
            if (!isOpen) {
                notificationsDropdown.classList.add('show');
                if (!notificationsLoaded) {
                    loadNotifications();
                }
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
        case 'message':
            iconContent = '✉️';
            iconClass = 'message';
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
    
    // Add click handler to navigate to project/conversation and mark as read
    div.addEventListener('click', () => {
        // Mark as read if unread
        if (!notification.is_read) {
            markNotificationAsRead(notification.id);
        }
        
        // Navigate based on notification type
        if (notification.type === 'message') {
            // Navigate to messages page with sender's user ID
            window.location.href = `/messages.html?userId=${notification.actor_user_id}`;
        } else if (notification.project_id) {
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
