# ProjecTra API Documentation

Base URL: `http://localhost:3000/api`

## Profile APIs

### 1. Get User Profile
**GET** `/profile/:userId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "position": "student",
    "organization": "MIT",
    "github_url": "https://github.com/johndoe",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "total_projects": 5,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-15T00:00:00.000Z"
  }
}
```

### 2. Create Profile
**POST** `/profile`

**Request Body:**
```json
{
  "username": "johndoe",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "phone": "1234567890",
  "position": "student",
  "organization": "MIT",
  "github_url": "https://github.com/johndoe",
  "linkedin_url": "https://linkedin.com/in/johndoe"
}
```

**Required Fields:** `username`, `name`, `email`, `password`, `position`

**Position Options:** `student`, `teacher`, `other`

**Response:**
```json
{
  "success": true,
  "message": "Profile created successfully",
  "data": {
    "userId": 1
  }
}
```

### 3. Update Profile (Partial Update)
**PATCH** `/profile/:userId`

**Request Body (all fields optional, send only what you want to update):**
```json
{
  "name": "John Updated",
  "email": "newemail@example.com",
  "password": "newpassword123",
  "phone": "9876543210",
  "position": "teacher",
  "organization": "Stanford",
  "github_url": "https://github.com/newprofile",
  "linkedin_url": "https://linkedin.com/in/newprofile"
}
```

**Examples:**

Update only name:
```json
{
  "name": "John Smith"
}
```

Update password only:
```json
{
  "password": "newSecurePassword456"
}
```

Update multiple fields:
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com",
  "position": "teacher"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### 4. Delete Profile
**DELETE** `/profile/:userId`

**Response:**
```json
{
  "success": true,
  "message": "Profile and all associated projects deleted successfully"
}
```

---

## Project APIs

### 1. Get All Projects (Public)
**GET** `/projects`

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `organization` (optional)
- `privacy` (optional, default: 'public')

**Example:** `/projects?page=1&limit=10&organization=MIT`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Project Name",
      "description": "Project description",
      "link": "https://github.com/user/project",
      "user_id": 1,
      "organization": "MIT",
      "upvotes": 10,
      "comments_count": 5,
      "tags": "web,react,nodejs",
      "privacy": "public",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-15T00:00:00.000Z",
      "username": "johndoe",
      "user_name": "John Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10
  }
}
```

### 2. Get Single Project
**GET** `/projects/:projectId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Project Name",
    "description": "Project description",
    "link": "https://github.com/user/project",
    "user_id": 1,
    "organization": "MIT",
    "upvotes": 10,
    "comments_count": 5,
    "tags": "web,react,nodejs",
    "privacy": "public",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-15T00:00:00.000Z",
    "username": "johndoe",
    "user_name": "John Doe",
    "user_email": "john@example.com"
  }
}
```

### 3. Get User's Projects
**GET** `/projects/user/:userId`

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Project Name",
      "description": "Project description",
      "link": "https://github.com/user/project",
      "user_id": 1,
      "organization": "MIT",
      "upvotes": 10,
      "comments_count": 5,
      "tags": "web,react,nodejs",
      "privacy": "public",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10
  }
}
```

### 4. Create Project
**POST** `/projects`

**Request Body:**
```json
{
  "name": "My Awesome Project",
  "description": "A detailed description of the project",
  "link": "https://github.com/user/project",
  "user_id": 1,
  "organization": "MIT",
  "tags": "web,react,nodejs,api",
  "privacy": "public"
}
```

**Required Fields:** `name`, `user_id`

**Privacy Options:** `public`, `private`, `organization`

**Response:**
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "projectId": 1
  }
}
```

### 5. Update Project (Partial Update)
**PATCH** `/projects/:projectId`

**Request Body (all fields optional):**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "link": "https://github.com/user/new-project",
  "organization": "Stanford",
  "tags": "web,vue,python",
  "privacy": "private"
}
```

**Examples:**

Update only name:
```json
{
  "name": "New Project Name"
}
```

Update description and link:
```json
{
  "description": "New description",
  "link": "https://newlink.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project updated successfully"
}
```

### 6. Delete Project
**DELETE** `/projects/:projectId`

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (only in development mode)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate username/email)
- `500` - Internal Server Error

---

## Setup Instructions

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials:
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=project_feed_db
```

4. Run the server:
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

5. Test the API:
```bash
curl http://localhost:3000/api/health
```

---

## Key Features

✅ **Profile Management:**
- Create profile with required fields (username, name, email, password, position)
- Update ANY profile field (one or multiple at once)
- Password hashing with bcrypt
- Delete account (cascades to delete all projects)
- Position dropdown values: student, teacher, other

✅ **Project Management:**
- Create projects linked to users
- Update ANY project field (one or multiple at once)
- Delete projects
- Auto-update user's total_projects count
- Privacy levels: public, private, organization

✅ **Partial Updates:**
- Both profile and project endpoints support updating only specific fields
- No need to send all fields, just the ones you want to change

✅ **Security:**
- Password hashing
- SQL injection prevention (parameterized queries)
- Input validation

✅ **Data Integrity:**
- Foreign key constraints
- Duplicate prevention for username/email
- CASCADE delete for user → projects
