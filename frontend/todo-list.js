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

const addTodoBtn = document.getElementById('addTodoBtn');
const emptyAddBtn = document.getElementById('emptyAddBtn');
const todoModal = document.getElementById('todoModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const todoForm = document.getElementById('todoForm');
const todoId = document.getElementById('todoId');
const todoProject = document.getElementById('todoProject');
const todoTitle = document.getElementById('todoTitle');
const todoDescription = document.getElementById('todoDescription');
const todoPriority = document.getElementById('todoPriority');
const todoStatus = document.getElementById('todoStatus');
const todoDueDate = document.getElementById('todoDueDate');
const modalTitle = document.getElementById('modalTitle');

const projectSelect = document.getElementById('projectSelect');
const statusFilter = document.getElementById('statusFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const tasksContainer = document.getElementById('tasksContainer');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');

let currentUserId = null;
let userProjects = [];
let allTodos = [];

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

    // Load user projects
    await loadUserProjects();
    // Load todos
    await loadTodos();

    // Event listeners
    addTodoBtn.addEventListener('click', openAddModal);
    emptyAddBtn.addEventListener('click', openAddModal);
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    todoForm.addEventListener('submit', handleSaveTodo);
    projectSelect.addEventListener('change', loadTodos);
    statusFilter.addEventListener('change', loadTodos);
    clearFiltersBtn.addEventListener('click', () => {
        projectSelect.value = '';
        statusFilter.value = '';
        loadTodos();
    });

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

    logoutBtn.addEventListener('click', () => {
        authManager.logout();
        window.location.href = '/auth/login.html';
    });
});

async function loadUserProjects() {
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/projects/user/${currentUserId}`
        );

        if (!response.ok) throw new Error('Failed to load projects');

        const data = await response.json();
        userProjects = data.data || [];

        // Populate both filter select and modal select
        const fragment1 = document.createDocumentFragment();
        const fragment2 = document.createDocumentFragment();
        
        const defaultOption1 = document.createElement('option');
        defaultOption1.value = '';
        defaultOption1.textContent = 'All Projects';
        fragment1.appendChild(defaultOption1);

        const defaultOption2 = document.createElement('option');
        defaultOption2.value = '';
        defaultOption2.textContent = 'Select a project';
        fragment2.appendChild(defaultOption2);

        userProjects.forEach(project => {
            const option1 = document.createElement('option');
            option1.value = project.id;
            option1.textContent = project.name;
            fragment1.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = project.id;
            option2.textContent = project.name;
            fragment2.appendChild(option2);
        });

        projectSelect.innerHTML = '';
        projectSelect.appendChild(fragment1);
        
        todoProject.innerHTML = '';
        todoProject.appendChild(fragment2);
    } catch (error) {
        console.error('Error loading projects:', error);
        // Show at least "All Projects" option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All Projects';
        projectSelect.appendChild(defaultOption);
    }
}

async function loadTodos() {
    try {
        loadingState.style.display = 'flex';
        tasksContainer.style.display = 'none';
        emptyState.style.display = 'none';

        let url = `${API_BASE_URL}/todos?`;
        if (projectSelect.value) {
            url += `projectId=${projectSelect.value}&`;
        }
        if (statusFilter.value) {
            url += `status=${statusFilter.value}`;
        }

        const response = await authManager.authenticatedFetch(url);

        if (!response.ok) throw new Error('Failed to load todos');

        const data = await response.json();
        allTodos = data.data || [];

        loadingState.style.display = 'none';

        if (allTodos.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            displayTodos();
            tasksContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading todos:', error);
        loadingState.style.display = 'none';
        emptyState.style.display = 'flex';
    }
}

function displayTodos() {
    tasksContainer.innerHTML = '';

    const statusGroups = {
        pending: [],
        in_progress: [],
        completed: []
    };

    // Get the selected filter
    const selectedStatus = statusFilter.value;

    allTodos.forEach(todo => {
        if (statusGroups[todo.status]) {
            statusGroups[todo.status].push(todo);
        }
    });

    // If a status filter is selected, only show that status
    if (selectedStatus) {
        const section = document.createElement('div');
        section.className = 'task-section';

        const title = document.createElement('h3');
        title.className = `section-title status-${selectedStatus}`;
        title.textContent = selectedStatus === 'pending' ? 'Pending' : selectedStatus === 'in_progress' ? 'In Progress' : 'Completed';
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'task-list';

        statusGroups[selectedStatus].forEach(todo => {
            const taskCard = createTaskCard(todo);
            list.appendChild(taskCard);
        });

        section.appendChild(list);
        tasksContainer.appendChild(section);
    } else {
        // Show all statuses
        Object.entries(statusGroups).forEach(([status, todos]) => {
            if (todos.length === 0) return;

            const section = document.createElement('div');
            section.className = 'task-section';

            const title = document.createElement('h3');
            title.className = `section-title status-${status}`;
            title.textContent = status === 'pending' ? 'Pending' : status === 'in_progress' ? 'In Progress' : 'Completed';
            section.appendChild(title);

            const list = document.createElement('div');
            list.className = 'task-list';

            todos.forEach(todo => {
                const taskCard = createTaskCard(todo);
                list.appendChild(taskCard);
            });

            section.appendChild(list);
            tasksContainer.appendChild(section);
        });
    }
}

function createTaskCard(todo) {
    const card = document.createElement('div');
    card.className = `task-card priority-${todo.priority} status-${todo.status}`;
    card.innerHTML = `
        <div class="task-header">
            <div class="task-title-section">
                <input type="checkbox" class="task-checkbox" ${todo.status === 'completed' ? 'checked' : ''}>
                <h4 class="task-title">${escapeHtml(todo.title)}</h4>
            </div>
            <div class="task-actions">
                <button class="task-btn edit-btn" title="Edit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="task-btn delete-btn" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        </div>
        ${todo.description ? `<p class="task-description">${escapeHtml(todo.description)}</p>` : ''}
        <div class="task-meta">
            <span class="task-project">${escapeHtml(todo.project_name)}</span>
            <span class="task-priority priority-${todo.priority}">${todo.priority.toUpperCase()}</span>
            ${todo.due_date ? `<span class="task-due-date">Due: ${formatDate(todo.due_date)}</span>` : ''}
        </div>
    `;

    const checkbox = card.querySelector('.task-checkbox');
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');

    checkbox.addEventListener('change', async () => {
        const newStatus = checkbox.checked ? 'completed' : 'pending';
        await updateTodo(todo.id, { status: newStatus });
    });

    editBtn.addEventListener('click', () => {
        openEditModal(todo);
    });

    deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this task?')) {
            await deleteTodo(todo.id);
        }
    });

    return card;
}

function openAddModal() {
    modalTitle.textContent = 'Add New Task';
    todoForm.reset();
    todoId.value = '';
    todoModal.classList.add('active');
}

function openEditModal(todo) {
    modalTitle.textContent = 'Edit Task';
    todoId.value = todo.id;
    todoProject.value = todo.project_id;
    todoTitle.value = todo.title;
    todoDescription.value = todo.description || '';
    todoPriority.value = todo.priority;
    todoStatus.value = todo.status;
    todoDueDate.value = todo.due_date || '';
    todoModal.classList.add('active');
}

function closeModal() {
    todoModal.classList.remove('active');
}

async function handleSaveTodo(e) {
    e.preventDefault();

    const data = {
        projectId: parseInt(todoProject.value),
        title: todoTitle.value,
        description: todoDescription.value,
        priority: todoPriority.value,
        dueDate: todoDueDate.value || null,
        status: todoStatus.value
    };

    try {
        let response;
        if (todoId.value) {
            // Update
            response = await authManager.authenticatedFetch(
                `${API_BASE_URL}/todos/${todoId.value}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                }
            );
        } else {
            // Create
            response = await authManager.authenticatedFetch(
                `${API_BASE_URL}/todos`,
                {
                    method: 'POST',
                    body: JSON.stringify(data)
                }
            );
        }

        if (!response.ok) {
            const error = await response.json();
            alert(error.message || 'Failed to save task');
            return;
        }

        closeModal();
        await loadTodos();
    } catch (error) {
        console.error('Error saving todo:', error);
        alert('Error saving task');
    }
}

async function deleteTodo(id) {
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/todos/${id}`,
            { method: 'DELETE' }
        );

        if (!response.ok) throw new Error('Failed to delete');

        await loadTodos();
    } catch (error) {
        console.error('Error deleting todo:', error);
        alert('Error deleting task');
    }
}

async function updateTodo(id, updates) {
    try {
        const response = await authManager.authenticatedFetch(
            `${API_BASE_URL}/todos/${id}`,
            {
                method: 'PATCH',
                body: JSON.stringify(updates)
            }
        );

        if (!response.ok) throw new Error('Failed to update');

        await loadTodos();
    } catch (error) {
        console.error('Error updating todo:', error);
        alert('Error updating task');
    }
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
