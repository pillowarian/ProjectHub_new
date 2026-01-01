# ProTrack (ProjectHub) - Project Presentation

## 1. Introduction: What & Why?

**Project Name:** ProTrack (Branded as ProjectHub)

**What is it?**
ProTrack is a comprehensive project management and portfolio tracking system designed to help students, developers, and professionals organize, showcase, and collaborate on their work.

**Why should you use it?**
*   **Centralized Portfolio:** A single place to keep all your projects, replacing scattered GitHub links or local folders.
*   **Organization:** Categorize projects with tags, manage privacy settings (Public/Private/Organization), and track progress.
*   **Networking:** Connect with others through profiles, likes, and comments.
*   **Simplicity:** A lightweight, fast, and focused user experience without the bloat of complex enterprise tools.

---

## 2. Technical Architecture Breakdown

### Part 1: Frontend (The User Experience)
*   **Technologies:** HTML5, CSS3, Vanilla JavaScript.
*   **Design Philosophy:**
    *   **Lightweight & Fast:** Built without heavy frameworks (like React/Angular) to ensure maximum performance and quick load times.
    *   **Responsive UI:** Designed to work seamlessly on desktops, tablets, and mobile devices.
    *   **Modern Aesthetics:** Features a clean, professional interface with modern gradients and intuitive layouts (e.g., the redesigned Login page).
*   **Key Modules:**
    *   **Authentication UI:** Secure login and registration forms.
    *   **Dashboard:** A dynamic home feed displaying projects.
    *   **Profile Management:** Tools to create, edit, and view detailed user profiles.
    *   **Project Views:** Detailed views for individual projects with interaction capabilities.

### Part 2: Backend + Deployment (The Engine)
*   **Technologies:** Node.js, Express.js.
*   **Architecture:** RESTful API.
*   **How it works:**
    *   **Modular Structure:** The backend is organized into `Controllers` (logic), `Routes` (API endpoints), and `Middleware` (security), making the code maintainable and scalable.
    *   **API-First Approach:** The frontend communicates with the backend via JSON APIs (`/api/projects`, `/api/auth`), allowing for future expansion (e.g., adding a mobile app).
*   **Deployment Readiness:**
    *   **Environment Configuration:** Uses `dotenv` to manage sensitive keys securely.
    *   **CORS Enabled:** Configured to handle cross-origin requests securely.
    *   **Scalability:** The stateless nature of the backend allows it to be easily deployed on cloud platforms like AWS, Heroku, or Vercel.

### Part 3: Database + Authentication (Security & Data)
*   **Database:** MySQL (Relational Database Management System).
*   **Data Structure (Schema):**
    *   **Relational Integrity:** Uses foreign keys to link `Projects` to `Users`, ensuring data consistency.
    *   **Optimized Tables:**
        *   `users`: Stores profile data, social links (GitHub/LinkedIn), and roles.
        *   `projects`: Stores metadata, privacy settings, and metrics (likes/comments).
        *   `tags`: Allows for flexible project categorization.
*   **Authentication & Security:**
    *   **Password Security:** User passwords are **never** stored in plain text. We use `bcrypt` to hash and salt passwords, making them secure against attacks.
    *   **Session Management:** Uses **JWT (JSON Web Tokens)**. When a user logs in, they receive a secure token. This token is sent with subsequent requests to prove identity, allowing for a stateless and efficient authentication flow.
    *   **Middleware Protection:** Custom middleware intercepts requests to ensure only authorized users can access private routes (like editing a profile or deleting a project).
