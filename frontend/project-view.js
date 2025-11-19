const API_BASE_URL = `${window.location.origin}/api`;

// Load auth manager
let authManager;
try {
    authManager = window.authManager;
} catch (e) {
    authManager = {
        getToken: () => localStorage.getItem('ProjecTra_token'),
        getUserData: () => {
            const data = localStorage.getItem('ProjecTra_user');
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

// Global variables
let currentProject = null;
let currentUserId = null;
let isOwner = false;
let isEditMode = false;
let commentsCurrentPage = 1;
let totalComments = 0;
let isLiked = false;

// Get project ID from URL parameters
function getProjectId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Get current user ID from JWT token
function getCurrentUserId() {
    const userData = authManager.getUserData();
    if (userData) return userData.userId;
    
    // Legacy fallback
    return localStorage.getItem('userId');
}

// Show/hide elements
function showElement(id) {
    document.getElementById(id).style.display = 'block';
}

function hideElement(id) {
    document.getElementById(id).style.display = 'none';
}

function showAlert(message, type = 'info') {
    const alertElement = document.getElementById('alertMessage');
    alertElement.className = `alert ${type}`;
    alertElement.textContent = message;
    alertElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Render tags
function renderTags(tagsString) {
    const tagsContainer = document.getElementById('projectTags');
    tagsContainer.innerHTML = '';
    
    if (!tagsString || tagsString.trim() === '') {
        tagsContainer.innerHTML = '<p style="color: #999; font-style: italic;">No tags specified</p>';
        return;
    }
    
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
    });
}

// Update privacy badge
function updatePrivacyBadge(privacy) {
    const badge = document.getElementById('privacyBadge');
    badge.className = `meta-item privacy-badge ${privacy}`;
    
    switch (privacy) {
        case 'public':
            badge.innerHTML = '🔓 Public';
            break;
        case 'private':
            badge.innerHTML = '🔒 Private';
            break;
        case 'organization':
            badge.innerHTML = '🏢 Organization';
            break;
        default:
            badge.innerHTML = '🔓 Public';
    }
}

// Load project data
async function loadProject() {
    const projectId = getProjectId();
    currentUserId = getCurrentUserId();
    
    if (!projectId) {
        showElement('errorState');
        hideElement('loadingState');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Project not found');
        }
        
        currentProject = data.data;
        isOwner = currentUserId && parseInt(currentUserId) === parseInt(currentProject.user_id);
        
        // Debug logging for ownership check
        console.log('Ownership check:', {
            currentUserId,
            projectUserId: currentProject.user_id,
            currentUserIdParsed: parseInt(currentUserId),
            projectUserIdParsed: parseInt(currentProject.user_id),
            isOwner
        });
        
        // Populate project data
        populateProjectView();
        
        // Load likes status and comments
        if (currentUserId) {
            await checkUserLiked();
        }
        await loadComments();
        
        // Show/hide edit controls based on ownership
        if (isOwner) {
            showElement('editToggleBtn');
            showElement('deleteProjectBtn');
        } else {
            hideElement('editToggleBtn');
            hideElement('deleteProjectBtn');
        }
        
        hideElement('loadingState');
        showElement('projectContent');
        
        // Check if should scroll to comments
        if (window.location.hash === '#comments') {
            document.getElementById('commentsSection').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Error loading project:', error);
        hideElement('loadingState');
        showElement('errorState');
    }
}

// Populate project view with data
function populateProjectView() {
    const project = currentProject;
    
    // Header information
    document.getElementById('projectName').textContent = project.name;
    document.getElementById('projectOwner').textContent = project.user_name || project.username;
    document.getElementById('projectOrg').textContent = project.organization || 'Not specified';
    document.getElementById('projectDate').textContent = formatDate(project.created_at);
    document.getElementById('likesCount').textContent = project.likes_count || 0;
    document.getElementById('commentsCount').textContent = project.comments_count || 0;
    
    // Update privacy badge
    updatePrivacyBadge(project.privacy);
    
    // Project details
    document.getElementById('projectDescription').textContent = project.description || 'No description provided.';
    
    // Project link
    const linkElement = document.getElementById('projectLink');
    if (project.link) {
        linkElement.innerHTML = `<a href="${project.link}" target="_blank" rel="noopener noreferrer">${project.link}</a>`;
    } else {
        linkElement.innerHTML = '<p style="color: #999; font-style: italic;">No project link provided</p>';
    }
    
    // Tags
    renderTags(project.tags);
    
    // Populate edit form
    if (isOwner) {
        populateEditForm();
    }
}

// Populate edit form with current data
function populateEditForm() {
    const project = currentProject;
    
    document.getElementById('editName').value = project.name || '';
    document.getElementById('editDescription').value = project.description || '';
    document.getElementById('editLink').value = project.link || '';
    document.getElementById('editOrganization').value = project.organization || '';
    document.getElementById('editTags').value = project.tags || '';
    document.getElementById('editPrivacy').value = project.privacy || 'public';
}

// Toggle edit mode
function toggleEditMode() {
    if (!isOwner) return;
    
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('editToggleBtn');
    
    if (isEditMode) {
        hideElement('viewMode');
        showElement('editMode');
        editBtn.innerHTML = '❌ Cancel Edit';
        editBtn.className = 'btn btn-secondary nav-btn';
    } else {
        showElement('viewMode');
        hideElement('editMode');
        editBtn.innerHTML = '✏️ Edit Mode';
        editBtn.className = 'btn btn-primary nav-btn';
        // Reset form to original values
        populateEditForm();
    }
}

// Save project changes
async function saveProject(event) {
    event.preventDefault();
    
    if (!isOwner) return;
    
    const saveBtn = document.getElementById('saveBtn');
    const btnText = saveBtn.querySelector('.btn-text');
    const spinner = saveBtn.querySelector('.spinner');
    
    // Show loading state
    saveBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const formData = {
            name: document.getElementById('editName').value.trim(),
            description: document.getElementById('editDescription').value.trim(),
            link: document.getElementById('editLink').value.trim(),
            organization: document.getElementById('editOrganization').value.trim(),
            tags: document.getElementById('editTags').value.trim(),
            privacy: document.getElementById('editPrivacy').value
        };
        
        // Validate required fields
        if (!formData.name) {
            throw new Error('Project name is required');
        }
        
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${currentProject.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to update project');
        }
        
        // Update current project data
        Object.assign(currentProject, formData);
        
        // Refresh view
        populateProjectView();
        toggleEditMode(); // Exit edit mode
        
        showAlert('Project updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving project:', error);
        showAlert(error.message, 'error');
    } finally {
        // Reset loading state
        saveBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Delete project
async function deleteProject() {
    if (!isOwner) return;
    
    const confirmBtn = document.getElementById('confirmDelete');
    const btnText = confirmBtn.querySelector('.btn-text');
    const spinner = confirmBtn.querySelector('.spinner');
    
    // Show loading state
    confirmBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${currentProject.id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to delete project');
        }
        
        showAlert('Project deleted successfully! Redirecting...', 'success');
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
            window.location.href = '/home.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting project:', error);
        showAlert(error.message, 'error');
        
        // Reset loading state
        confirmBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Load user profile
async function loadUserProfile(userId) {
    const modal = document.getElementById('userProfileModal');
    const profileLoading = document.getElementById('profileLoading');
    const profileContent = document.getElementById('profileContent');
    
    // Show modal and loading state
    modal.classList.add('active');
    profileLoading.style.display = 'block';
    profileContent.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile/${userId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'User profile not found');
        }
        
        const profile = data.data;
        
        // Populate profile information (excluding sensitive data like email)
        document.getElementById('profileName').textContent = profile.name || '-';
        document.getElementById('profileUsername').textContent = profile.username || '-';
        document.getElementById('profilePosition').textContent = profile.position || '-';
        document.getElementById('profileOrganization').textContent = profile.organization || '-';
        document.getElementById('profileTotalProjects').textContent = profile.total_projects || 0;
        document.getElementById('profileMemberSince').textContent = formatDate(profile.created_at);
        
        // Social links
        const githubLink = document.getElementById('profileGithub');
        const linkedInLink = document.getElementById('profileLinkedIn');
        
        if (profile.github_url) {
            githubLink.href = profile.github_url;
            githubLink.style.display = 'block';
        } else {
            githubLink.style.display = 'none';
        }
        
        if (profile.linkedin_url) {
            linkedInLink.href = profile.linkedin_url;
            linkedInLink.style.display = 'block';
        } else {
            linkedInLink.style.display = 'none';
        }
        
        // Show profile content
        profileLoading.style.display = 'none';
        profileContent.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading profile:', error);
        profileLoading.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p>Failed to load profile</p>
                <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Check if current user liked the project
async function checkUserLiked() {
    if (!currentUserId || !currentProject) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects?userId=${currentUserId}&limit=1`);
        // For now, we'll track this in the frontend state
        // In a real app, we'd modify the API to return user like status
        updateLikeButton();
    } catch (error) {
        console.error('Error checking like status:', error);
    }
}

// Update like button appearance
function updateLikeButton() {
    const likeBtn = document.getElementById('likeBtn');
    const likeIcon = document.getElementById('likeIcon');
    const likesCount = document.getElementById('likesCount');
    
    if (!likeBtn) return;
    
    if (isLiked) {
        likeBtn.classList.add('liked');
        likeIcon.textContent = '❤️';
    } else {
        likeBtn.classList.remove('liked');
        likeIcon.textContent = '🤍';
    }
}

// Toggle project like
async function toggleProjectLike() {
    if (!currentUserId) {
        showAlert('Please log in to like projects', 'error');
        return;
    }
    
    const likeBtn = document.getElementById('likeBtn');
    const originalState = isLiked;
    
    // Optimistically update UI
    isLiked = !isLiked;
    updateLikeButton();
    
    // Update count immediately
    const likesCountEl = document.getElementById('likesCount');
    const currentCount = parseInt(likesCountEl.textContent) || 0;
    likesCountEl.textContent = isLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${currentProject.id}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Update with server response
            isLiked = data.data.liked;
            likesCountEl.textContent = data.data.likesCount;
            updateLikeButton();
            currentProject.likes_count = data.data.likesCount;
        } else {
            throw new Error(data.message || 'Failed to update like');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        // Revert changes
        isLiked = originalState;
        updateLikeButton();
        likesCountEl.textContent = currentProject.likes_count || 0;
        showAlert('Failed to update like. Please try again.', 'error');
    }
}

// Load comments
async function loadComments(reset = false) {
    if (!currentProject) return;
    
    if (reset) {
        commentsCurrentPage = 1;
        document.getElementById('commentsList').innerHTML = '';
    }
    
    const commentsLoading = document.getElementById('commentsLoading');
    const loadMoreCommentsBtn = document.getElementById('loadMoreComments');
    
    commentsLoading.style.display = 'block';
    
    try {
        const url = `${API_BASE_URL}/projects/${currentProject.id}/comments?page=${commentsCurrentPage}&limit=10${currentUserId ? `&userId=${currentUserId}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayComments(data.data);
            
            // Show/hide load more button
            if (data.data.length < 10) {
                loadMoreCommentsBtn.style.display = 'none';
            } else {
                loadMoreCommentsBtn.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        showAlert('Failed to load comments', 'error');
    } finally {
        commentsLoading.style.display = 'none';
    }
}

// Display comments
function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    
    comments.forEach(comment => {
        const commentElement = createCommentElement(comment);
        commentsList.appendChild(commentElement);
    });
    
    if (comments.length === 0 && commentsCurrentPage === 1) {
        commentsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No comments yet. Be the first to comment!</p>';
    }
}

// Create comment element
function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.dataset.commentId = comment.id;
    
    const isCommentLiked = comment.user_liked_comment > 0;
    
    commentDiv.innerHTML = `
        <div class="comment-header">
            <div class="comment-author">
                <div class="author-avatar">${getInitials(comment.user_name)}</div>
                <div class="author-info">
                    <span class="author-name">${comment.user_name}</span>
                    <span class="author-username">@${comment.username}</span>
                </div>
            </div>
            <span class="comment-date">${formatRelativeTime(comment.created_at)}</span>
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
        <div class="comment-footer">
            <button class="comment-like-btn ${isCommentLiked ? 'liked' : ''}" 
                    onclick="toggleCommentLike(${comment.id}, this)"
                    ${!currentUserId ? 'disabled' : ''}>
                <span class="like-icon">${isCommentLiked ? '❤️' : '🤍'}</span>
                <span class="like-count">${comment.likes_count || 0}</span>
            </button>
            ${comment.replies_count > 0 ? `
                <button class="replies-btn" onclick="toggleReplies(${comment.id})">
                    💬 ${comment.replies_count} ${comment.replies_count === 1 ? 'reply' : 'replies'}
                </button>
            ` : ''}
            <button class="reply-btn" onclick="toggleReplyForm(${comment.id})" 
                    ${!currentUserId ? 'disabled' : ''}>
                Reply
            </button>
        </div>
        <div class="replies-container" id="replies-${comment.id}" style="display: none;"></div>
        <div class="reply-form-container" id="replyForm-${comment.id}" style="display: none;">
            <form class="reply-form" onsubmit="submitReply(event, ${comment.id})">
                <textarea placeholder="Write a reply..." required></textarea>
                <div class="reply-form-actions">
                    <button type="button" onclick="toggleReplyForm(${comment.id})">Cancel</button>
                    <button type="submit">Reply</button>
                </div>
            </form>
        </div>
    `;
    
    return commentDiv;
}

// Get user initials
function getInitials(name) {
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Format relative time
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
    
    return formatDate(dateString);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Submit new comment
async function submitComment(event) {
    event.preventDefault();
    
    if (!currentUserId) {
        showAlert('Please log in to comment', 'error');
        return;
    }
    
    const form = event.target;
    const textarea = form.querySelector('textarea');
    const content = textarea.value.trim();
    
    if (!content) {
        showAlert('Please enter a comment', 'error');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${currentProject.id}/comments`, {
            method: 'POST',
            body: JSON.stringify({
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Add new comment to the top
            const commentElement = createCommentElement(data.data);
            const commentsList = document.getElementById('commentsList');
            
            if (commentsList.innerHTML.includes('No comments yet')) {
                commentsList.innerHTML = '';
            }
            
            commentsList.insertBefore(commentElement, commentsList.firstChild);
            
            // Update comments count
            const commentsCountEl = document.getElementById('commentsCount');
            const currentCount = parseInt(commentsCountEl.textContent) || 0;
            commentsCountEl.textContent = currentCount + 1;
            
            // Clear form
            textarea.value = '';
            showAlert('Comment posted successfully!', 'success');
        } else {
            throw new Error(data.message || 'Failed to post comment');
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        showAlert('Failed to post comment. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Comment';
    }
}

// Toggle comment like
async function toggleCommentLike(commentId, button) {
    if (!currentUserId) {
        showAlert('Please log in to like comments', 'error');
        return;
    }
    
    const likeIcon = button.querySelector('.like-icon');
    const likeCount = button.querySelector('.like-count');
    const wasLiked = button.classList.contains('liked');
    
    // Optimistically update UI
    button.classList.toggle('liked');
    likeIcon.textContent = wasLiked ? '🤍' : '❤️';
    const currentCount = parseInt(likeCount.textContent) || 0;
    likeCount.textContent = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/comments/${commentId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Update with server response
            if (data.data.liked) {
                button.classList.add('liked');
                likeIcon.textContent = '❤️';
            } else {
                button.classList.remove('liked');
                likeIcon.textContent = '🤍';
            }
            likeCount.textContent = data.data.likesCount;
        } else {
            throw new Error(data.message || 'Failed to update like');
        }
    } catch (error) {
        console.error('Error toggling comment like:', error);
        // Revert changes
        button.classList.toggle('liked');
        likeIcon.textContent = wasLiked ? '❤️' : '🤍';
        likeCount.textContent = currentCount;
        showAlert('Failed to update like. Please try again.', 'error');
    }
}

// Toggle reply form
function toggleReplyForm(commentId) {
    const replyForm = document.getElementById(`replyForm-${commentId}`);
    if (replyForm.style.display === 'none') {
        replyForm.style.display = 'block';
        replyForm.querySelector('textarea').focus();
    } else {
        replyForm.style.display = 'none';
        replyForm.querySelector('textarea').value = '';
    }
}

// Submit reply
async function submitReply(event, parentCommentId) {
    event.preventDefault();
    
    if (!currentUserId) {
        showAlert('Please log in to reply', 'error');
        return;
    }
    
    const form = event.target;
    const textarea = form.querySelector('textarea');
    const content = textarea.value.trim();
    
    if (!content) {
        showAlert('Please enter a reply', 'error');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Replying...';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/projects/${currentProject.id}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                parentCommentId: parentCommentId
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Hide reply form
            toggleReplyForm(parentCommentId);
            showAlert('Reply posted successfully!', 'success');
            
            // Optionally refresh replies if they're currently shown
            const repliesContainer = document.getElementById(`replies-${parentCommentId}`);
            if (repliesContainer.style.display !== 'none') {
                loadReplies(parentCommentId);
            }
        } else {
            throw new Error(data.message || 'Failed to post reply');
        }
    } catch (error) {
        console.error('Error posting reply:', error);
        showAlert('Failed to post reply. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reply';
    }
}

// Toggle replies visibility
async function toggleReplies(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    
    if (repliesContainer.style.display === 'none') {
        repliesContainer.style.display = 'block';
        await loadReplies(commentId);
    } else {
        repliesContainer.style.display = 'none';
    }
}

// Load replies for a comment
async function loadReplies(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    repliesContainer.innerHTML = '<p style="color: #999; padding: 10px;">Loading replies...</p>';
    
    try {
        const url = `${API_BASE_URL}/projects/comments/${commentId}/replies?limit=20${currentUserId ? `&userId=${currentUserId}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            repliesContainer.innerHTML = '';
            data.data.forEach(reply => {
                const replyElement = createReplyElement(reply);
                repliesContainer.appendChild(replyElement);
            });
            
            if (data.data.length === 0) {
                repliesContainer.innerHTML = '<p style="color: #999; padding: 10px;">No replies yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading replies:', error);
        repliesContainer.innerHTML = '<p style="color: #e74c3c; padding: 10px;">Failed to load replies.</p>';
    }
}

// Create reply element
function createReplyElement(reply) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply';
    
    const isReplyLiked = reply.user_liked_comment > 0;
    
    replyDiv.innerHTML = `
        <div class="comment-header">
            <div class="comment-author">
                <div class="author-avatar small">${getInitials(reply.user_name)}</div>
                <div class="author-info">
                    <span class="author-name">${reply.user_name}</span>
                    <span class="author-username">@${reply.username}</span>
                </div>
            </div>
            <span class="comment-date">${formatRelativeTime(reply.created_at)}</span>
        </div>
        <div class="comment-content">${escapeHtml(reply.content)}</div>
        <div class="comment-footer">
            <button class="comment-like-btn ${isReplyLiked ? 'liked' : ''}" 
                    onclick="toggleCommentLike(${reply.id}, this)"
                    ${!currentUserId ? 'disabled' : ''}>
                <span class="like-icon">${isReplyLiked ? '❤️' : '🤍'}</span>
                <span class="like-count">${reply.likes_count || 0}</span>
            </button>
        </div>
    `;
    
    return replyDiv;
}

// Load more comments
function loadMoreComments() {
    commentsCurrentPage++;
    loadComments();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load project on page load
    loadProject();
    
    // Like button
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', toggleProjectLike);
    }
    
    // Comment form
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
        commentForm.addEventListener('submit', submitComment);
    }
    
    // Load more comments button
    const loadMoreCommentsBtn = document.getElementById('loadMoreComments');
    if (loadMoreCommentsBtn) {
        loadMoreCommentsBtn.addEventListener('click', loadMoreComments);
    }
    
    // Edit toggle button
    const editToggleBtn = document.getElementById('editToggleBtn');
    if (editToggleBtn) {
        editToggleBtn.addEventListener('click', toggleEditMode);
    }
    
    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', toggleEditMode);
    }
    
    // Save project form
    const editForm = document.getElementById('editProjectForm');
    if (editForm) {
        editForm.addEventListener('submit', saveProject);
    }
    
    // Delete project buttons
    const deleteBtn = document.getElementById('deleteProjectBtn');
    const deleteModal = document.getElementById('deleteModal');
    const confirmDelete = document.getElementById('confirmDelete');
    const cancelDelete = document.getElementById('cancelDelete');
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteModal.classList.add('active'));
    }
    
    if (confirmDelete) {
        confirmDelete.addEventListener('click', deleteProject);
    }
    
    if (cancelDelete) {
        cancelDelete.addEventListener('click', () => closeModal('deleteModal'));
    }
    
    // Profile modal
    const projectOwner = document.getElementById('projectOwner');
    const closeProfileModal = document.getElementById('closeProfileModal');
    
    if (projectOwner) {
        projectOwner.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentProject) {
                loadUserProfile(currentProject.user_id);
            }
        });
    }
    
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => closeModal('userProfileModal'));
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
    
    // Check if user is logged in
    if (!getCurrentUserId()) {
        console.warn('No user logged in');
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function() {
    loadProject();
});