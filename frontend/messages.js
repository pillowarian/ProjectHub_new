const API_BASE_URL = `${window.location.origin}/api`;

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

// DOM Elements
const userInitials = document.getElementById('userInitials');
const userName = document.getElementById('userName');
const userMenuBtn = document.getElementById('userMenuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutBtn = document.getElementById('logoutBtn');

const newMessageBtn = document.getElementById('newMessageBtn');
const emptyNewMessageBtn = document.getElementById('emptyNewMessageBtn');
const newMessageModal = document.getElementById('newMessageModal');
const newMessageOverlay = document.getElementById('newMessageOverlay');
const newMessageClose = document.getElementById('newMessageClose');

const conversationsList = document.getElementById('conversationsList');
const conversationsLoading = document.getElementById('conversationsLoading');
const conversationsEmpty = document.getElementById('conversationsEmpty');
const searchConversations = document.getElementById('searchConversations');

const noChatSelected = document.getElementById('noChatSelected');
const chatContent = document.getElementById('chatContent');
const chatHeader = document.querySelector('.chat-header');
const chatUserInitials = document.getElementById('chatUserInitials');
const chatUserName = document.getElementById('chatUserName');
const chatUserPosition = document.getElementById('chatUserPosition');
const messagesArea = document.getElementById('messagesArea');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

const userSearch = document.getElementById('userSearch');
const userList = document.getElementById('userList');

let currentUserId = null;
let currentChatUserId = null;
let conversations = [];
let allOrgMembers = [];
let messageRefreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const userData = authManager.getUserData();
    if (!userData) {
        window.location.href = '/auth/login.html';
        return;
    }

    currentUserId = userData.userId;
    const initials = userData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    userInitials.textContent = initials;
    userName.textContent = userData.name;

    // Load conversations
    await loadConversations();
    // Load org members for new message
    await loadOrgMembers();

    // Check if userId parameter exists to auto-open conversation
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    if (userIdParam) {
        currentChatUserId = parseInt(userIdParam);
        // Find and select the conversation
        const conv = conversations.find(c => c.other_user_id === currentChatUserId);
        if (conv) {
            await selectConversation(conv);
        } else {
            // If conversation doesn't exist yet, try to load user and create one
            const member = allOrgMembers.find(m => m.id === currentChatUserId);
            if (member) {
                await selectOrCreateConversationFor(member);
            }
        }
    }

    // Event listeners
    newMessageBtn.addEventListener('click', openNewMessageModal);
    emptyNewMessageBtn.addEventListener('click', openNewMessageModal);
    newMessageClose.addEventListener('click', closeNewMessageModal);
    newMessageOverlay.addEventListener('click', closeNewMessageModal);
    messageForm.addEventListener('submit', handleSendMessage);
    searchConversations.addEventListener('input', filterConversations);
    userSearch.addEventListener('input', filterUsers);

    // Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => window.history.back());
    }

    // User menu
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('active');
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authManager.logout();
            window.location.href = '/auth/login.html';
        });
    }
});

async function loadConversations() {
    try {
        conversationsLoading.style.display = 'flex';
        conversationsList.innerHTML = '';
        conversationsEmpty.style.display = 'none';

        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/messages/conversations`
        );

        if (!response.ok) throw new Error('Failed to load conversations');

        const data = await response.json();
        conversations = data.data || [];

        conversationsLoading.style.display = 'none';

        if (conversations.length === 0) {
            conversationsEmpty.style.display = 'block';
        } else {
            displayConversations(conversations);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        conversationsLoading.style.display = 'none';
        conversationsEmpty.style.display = 'block';
    }
}

function displayConversations(convs) {
    conversationsList.innerHTML = '';

    convs.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (currentChatUserId === conv.other_user_id) {
            item.classList.add('active');
        }

        const unreadClass = conv.unread_count > 0 ? 'unread' : '';
        
        item.innerHTML = `
            <div class="conversation-avatar">
                <span>${(conv.name[0] || '').toUpperCase()}</span>
            </div>
            <div class="conversation-content">
                <h4>${escapeHtml(conv.name)}</h4>
                <p class="last-message ${unreadClass}">${escapeHtml(conv.last_message.substring(0, 50))}${conv.last_message.length > 50 ? '...' : ''}</p>
            </div>
            ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : ''}
        `;

        item.addEventListener('click', () => {
            selectConversation(conv);
        });

        conversationsList.appendChild(item);
    });
}

async function selectConversation(conv) {
    currentChatUserId = conv.other_user_id;
    chatUserInitials.textContent = (conv.name[0] || '').toUpperCase();
    chatUserName.textContent = conv.name;
    chatUserPosition.textContent = conv.position || '';

    noChatSelected.style.display = 'none';
    chatContent.style.display = 'flex';

    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    // Safely set active on the matching item
    const active = Array.from(document.querySelectorAll('.conversation-item')).find(el => {
        const nameEl = el.querySelector('.conversation-content h4');
        return nameEl && nameEl.textContent === conv.name;
    });
    if (active) active.classList.add('active');

    // Load messages
    await loadMessages();

    // Clear previous interval
    if (messageRefreshInterval) clearInterval(messageRefreshInterval);

    // Refresh messages every 3 seconds (debounced)
    messageRefreshInterval = setInterval(() => {
        loadMessages(true);
    }, 3000);
}

async function loadMessages(isRefresh = false) {
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/messages/conversation/${currentChatUserId}`
        );

        if (!response.ok) throw new Error('Failed to load messages');

        const data = await response.json();
        const messages = data.data || [];

        if (!isRefresh || messages.length !== messagesArea.children.length) {
            displayMessages(messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessages(messages) {
    messagesArea.innerHTML = '';

    messages.forEach(msg => {
        const msgElement = document.createElement('div');
        msgElement.className = `message ${msg.sender_id === currentUserId ? 'sent' : 'received'}`;
        msgElement.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(msg.content)}</p>
                <span class="message-time">${formatTime(msg.created_at)}</span>
            </div>
        `;
        messagesArea.appendChild(msgElement);
    });

    // Scroll to bottom after DOM update
    setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 0);
}

async function handleSendMessage(e) {
    e.preventDefault();

    if (!messageInput.value.trim() || !currentChatUserId) return;

    const content = messageInput.value;
    messageInput.value = '';

    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/messages/send`,
            {
                method: 'POST',
                body: JSON.stringify({
                    recipientId: currentChatUserId,
                    content: content
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            alert(error.message || 'Failed to send message');
            messageInput.value = content;
            return;
        }

        // Reload messages
        await loadMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message');
        messageInput.value = content;
    }
}

async function loadOrgMembers() {
    try {
        const userData = authManager.getUserData();
        console.log('User data:', userData);
        
        if (!userData) {
            console.error('No user data available');
            return;
        }
        
        if (!userData.organization) {
            console.warn('User organization not set:', userData);
            return;
        }

        console.log('Fetching members for organization:', userData.organization);
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/users/organization/${userData.organization}/members`
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load members');
        }

        const data = await response.json();
        allOrgMembers = data.data || [];
        console.log('Organization members loaded:', allOrgMembers);
    } catch (error) {
        console.error('Error loading org members:', error);
        allOrgMembers = [];
    }
}

function openNewMessageModal() {
    newMessageModal.classList.add('active');
    userSearch.value = '';
    filterUsers();
}

function closeNewMessageModal() {
    newMessageModal.classList.remove('active');
}

function filterUsers() {
    const searchTerm = userSearch.value.toLowerCase();
    const filtered = allOrgMembers.filter(member => 
        member.id !== currentUserId &&
        (member.name.toLowerCase().includes(searchTerm) || 
         member.username.toLowerCase().includes(searchTerm))
    );

    displayUserList(filtered);
}

function displayUserList(members) {
    userList.innerHTML = '';

    if (members.length === 0) {
        userList.innerHTML = '<p class="no-results">No users found</p>';
        return;
    }

    members.forEach(member => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-avatar">
                <span>${(member.name[0] || '').toUpperCase()}</span>
            </div>
            <div class="user-info">
                <h4>${escapeHtml(member.name)}</h4>
                <p>@${escapeHtml(member.username)}</p>
            </div>
        `;

        userItem.addEventListener('click', async () => {
            // Start or open conversation with selected user
            currentChatUserId = member.id;
            closeNewMessageModal();
            // Attempt to load conversation immediately
            await selectOrCreateConversationFor(member);
        });

        userList.appendChild(userItem);
    });
}

async function selectOrCreateConversationFor(member) {
    // Try to find existing conversation first
    await loadConversations();
    let conv = conversations.find(c => c.other_user_id === member.id);
    if (conv) {
        await selectConversation(conv);
        return;
    }
    // No conversation yet: optimistically set header and open chat
    conv = {
        other_user_id: member.id,
        name: member.name,
        position: member.position || ''
    };
    await selectConversation(conv);
}

function filterConversations() {
    const searchTerm = searchConversations.value.toLowerCase();
    const filtered = conversations.filter(conv =>
        conv.name.toLowerCase().includes(searchTerm) ||
        conv.last_message.toLowerCase().includes(searchTerm)
    );

    displayConversations(filtered);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    if (diffHours < 1) {
        const diffMins = Math.floor((now - date) / (1000 * 60));
        return diffMins < 1 ? 'Now' : `${diffMins}m ago`;
    }

    if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
