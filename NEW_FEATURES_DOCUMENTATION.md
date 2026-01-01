# ProTrack New Features Documentation

## Overview
This document outlines the three new features implemented in ProTrack:

1. **Follow Users & Messaging** - Within organization collaboration
2. **To-Do List** - Task management for personal projects
3. **Project Collaborators** - Add team members to projects

---

## Feature 1: Follow Users & Messaging

### Description
Users can now follow other users within their organization and send direct messages to them.

### Database Changes
**New Table: `user_follows`**
```sql
- id: PRIMARY KEY
- follower_id: FOREIGN KEY to users
- following_id: FOREIGN KEY to users
- created_at: TIMESTAMP
- UNIQUE constraint on (follower_id, following_id)
```

**New Table: `messages`**
```sql
- id: PRIMARY KEY
- sender_id: FOREIGN KEY to users
- recipient_id: FOREIGN KEY to users
- content: TEXT
- is_read: BOOLEAN
- created_at: TIMESTAMP
```

### Backend API Endpoints

#### User Follow Endpoints
- `POST /api/users/:userId/follow` - Follow a user
- `POST /api/users/:userId/unfollow` - Unfollow a user
- `GET /api/users/:userId/followers` - Get user's followers
- `GET /api/users/:userId/following` - Get users this user is following
- `GET /api/users/:userId/is-following` - Check if following a user
- `GET /api/users/organization/:organization/members` - Get all members in organization

#### Message Endpoints
- `POST /api/messages/send` - Send a message
- `GET /api/messages/conversation/:userId` - Get conversation with a user
- `GET /api/messages/conversations` - Get all conversations
- `PATCH /api/messages/:messageId/read` - Mark message as read
- `DELETE /api/messages/:messageId` - Delete a message

### Frontend Components

#### Pages
- **view-profile.html** - Added "Follow" and "Message" buttons
- **messages.html** - New dedicated messaging page with:
  - Conversation list with search
  - Chat area with message history
  - Real-time message updates (2-second refresh)
  - New conversation modal

#### JavaScript
- **view-profile.js** - Added follow/message button handlers
- **messages.js** - Complete messaging interface logic
- **home.js** - Navigation to messages page

#### Styles
- **messages.css** - Stylish message interface with:
  - Conversation panel with real-time updates
  - Chat area with message bubbles
  - Responsive design for mobile

### Features
✅ Follow users within your organization only  
✅ See followers and following lists  
✅ Send and receive direct messages  
✅ Mark messages as read  
✅ Delete messages  
✅ Search conversations  
✅ Real-time message updates  
✅ View all conversations  

### Access Control
- Users can only follow/message users in the same organization
- Users can only follow non-themselves
- Messages only visible to sender and recipient

---

## Feature 2: To-Do List

### Description
Users can create and manage a personal to-do list for their projects with different status and priority levels.

### Database Changes
**New Table: `to_do_items`**
```sql
- id: PRIMARY KEY
- user_id: FOREIGN KEY to users
- project_id: FOREIGN KEY to projects
- title: VARCHAR(255)
- description: TEXT
- status: ENUM('pending', 'in_progress', 'completed')
- priority: ENUM('low', 'medium', 'high')
- due_date: DATE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Backend API Endpoints
- `POST /api/todos` - Create a new to-do item
- `GET /api/todos` - Get all user's to-do items (with project filter and status filter)
- `GET /api/todos/project/:projectId` - Get to-dos for a specific project
- `PATCH /api/todos/:todoId` - Update a to-do item
- `DELETE /api/todos/:todoId` - Delete a to-do item

### Frontend Components

#### Pages
- **todo-list.html** - Dedicated to-do list management page with:
  - Project selector (only user's projects)
  - Status filters (pending, in progress, completed)
  - Task cards grouped by status
  - Add/Edit task modal

#### JavaScript
- **todo-list.js** - Complete to-do management logic:
  - Load user's projects on page load
  - Filter tasks by project and status
  - Create, update, delete tasks
  - Mark tasks as complete with checkbox
  - Real-time UI updates

#### Styles
- **todo-list.css** - Task management interface with:
  - Color-coded priority levels (high=red, medium=orange, low=blue)
  - Status-based task grouping
  - Task cards with actions
  - Modal for creating/editing tasks
  - Responsive design

### Features
✅ Create to-do items only for own projects  
✅ Filter to-dos by project (only user's projects)  
✅ Filter to-dos by status  
✅ Priority levels (low, medium, high)  
✅ Due dates  
✅ Mark tasks as complete  
✅ Edit existing tasks  
✅ Delete tasks  
✅ Sort by due date and priority  

### Access Control
- Users can only create to-dos for their own projects
- Users can only view and edit their own to-dos
- Backend validates project ownership before allowing to-do creation

---

## Feature 3: Project Collaborators

### Description
When creating a project, users can add collaborators from their organization.

### Database Changes
**New Table: `project_collaborators`**
```sql
- id: PRIMARY KEY
- project_id: FOREIGN KEY to projects
- user_id: FOREIGN KEY to users
- role: ENUM('collaborator', 'co-owner')
- created_at: TIMESTAMP
- UNIQUE constraint on (project_id, user_id)
```

### Backend API Endpoints
- `POST /api/collaborators/project/:projectId/add` - Add a collaborator to project
- `DELETE /api/collaborators/project/:projectId/remove/:userId` - Remove collaborator
- `GET /api/collaborators/project/:projectId/collaborators` - Get project's collaborators
- `GET /api/collaborators/project/:projectId/available-members` - Get available members to add (same org, not already collaborators)

### Frontend Components

#### Integration
- **home.html** - Project creation modal updated with:
  - Collaborator search input
  - List of organization members with checkboxes
  - Selected collaborators display as tags
  - Option to remove selected collaborators

#### JavaScript
- **home.js** - Added collaborator functionality:
  - Load organization members when modal opens
  - Search/filter collaborators by name
  - Select/deselect collaborators with checkboxes
  - Add selected collaborators after project creation
  - Remove collaborators from selection

#### Styles
- **home.css** - Added collaborator UI styling:
  - Collaborator selector container
  - Member list with checkboxes
  - Selected collaborator tags
  - Responsive checkbox layout

### Features
✅ Search for collaborators by name/username  
✅ Select multiple collaborators from same organization  
✅ Remove selected collaborators before submission  
✅ Collaborators automatically added to project after creation  
✅ View project collaborators list  
✅ Remove collaborators from project (owner only)  
✅ Only members from same organization can be added  
✅ Cannot add project owner as collaborator  

### Access Control
- Only project owner can add/remove collaborators
- Collaborators must be from the same organization as the project
- Project owner cannot be added as collaborator
- Users can only manage collaborators for their own projects

---

## Testing Checklist

### Database
- [ ] All four new tables created in database
- [ ] All indexes and foreign keys properly configured
- [ ] Check unique constraints on user_follows and project_collaborators

### Backend API Testing
#### Follow/Messages
- [ ] Follow user in same organization
- [ ] Cannot follow self
- [ ] Cannot follow users in different organization
- [ ] Unfollow works correctly
- [ ] Get followers list
- [ ] Get following list
- [ ] Send message between org members
- [ ] Cannot message users in different org
- [ ] Mark message as read
- [ ] Delete message
- [ ] Get all conversations
- [ ] Get conversation with specific user

#### To-Do List
- [ ] Create to-do for own project
- [ ] Cannot create to-do for other's project
- [ ] Get all user's to-dos
- [ ] Filter by project
- [ ] Filter by status
- [ ] Update to-do status/priority
- [ ] Delete to-do
- [ ] Get project-specific to-dos

#### Collaborators
- [ ] Add collaborator from same org
- [ ] Cannot add self as collaborator
- [ ] Cannot add from different org
- [ ] Remove collaborator
- [ ] Get project collaborators
- [ ] Get available members for adding

### Frontend Testing
#### Follow/Messages
- [ ] Follow button appears on other users' profiles
- [ ] Edit Profile button appears only on own profile
- [ ] Message button works and navigates to messages page
- [ ] Can start new message conversation
- [ ] Can send/receive messages in real-time
- [ ] Conversations list updates
- [ ] Search conversations works
- [ ] Message timestamps display correctly

#### To-Do List
- [ ] To-Do button navigates to to-do-list.html
- [ ] Project selector populated with only own projects
- [ ] Tasks grouped by status
- [ ] Checkbox marks task as complete
- [ ] Can edit task
- [ ] Can delete task
- [ ] Filters work correctly
- [ ] Clear filters button works

#### Collaborators
- [ ] Collaborator search filters by name
- [ ] Can select multiple collaborators
- [ ] Selected collaborators show as tags
- [ ] Can remove selected collaborators
- [ ] Collaborators added after project creation

---

## File Structure

### Backend Files Created
```
backend/
  controllers/
    - userController.js (follow/unfollow logic)
    - messageController.js (messaging logic)
    - todoController.js (to-do CRUD logic)
    - collaboratorController.js (collaborator management)
  routes/
    - userRoutes.js
    - messageRoutes.js
    - todoRoutes.js
    - collaboratorRoutes.js
```

### Frontend Files Created
```
frontend/
  - todo-list.html, todo-list.js, todo-list.css
  - messages.html, messages.js, messages.css
```

### Frontend Files Modified
```
frontend/
  - home.html (added to-do, messages buttons, collaborator selector)
  - home.js (added collaborator logic, navigation handlers)
  - home.css (added collaborator selector styles)
  - view-profile.html (added follow, message buttons)
  - view-profile.js (added follow/message handlers)
```

### Database
```
database/
  - schema.sql (added 4 new tables)
```

### Server
```
backend/
  - server.js (registered new routes)
```

---

## Important Notes

1. **Organization-Only Features**: Follow, messages, and collaborator addition only work within the same organization
2. **User Ownership**: Users can only manage their own to-dos and projects
3. **Real-time Updates**: Messages refresh every 2 seconds for real-time conversation
4. **Access Control**: All endpoints validate user authentication and ownership/organization
5. **Error Handling**: Comprehensive error messages for all operations
6. **Responsive Design**: All new UI is mobile-friendly

---

## Future Enhancements
- WebSocket implementation for real-time messaging (replace polling)
- Typing indicators in messages
- Message read receipts
- Recurring to-do items
- Team/group collaboration
- Calendar view for to-dos
- Email notifications for messages

---

## Deployment Notes
1. Run the updated schema.sql to create new tables
2. Ensure all new environment variables are set (if any)
3. Test API endpoints before deploying to production
4. Verify organization data is correctly populated in users table
5. Test cross-organization access restrictions

---

## Support
For any issues or questions about these new features, refer to the API documentation and test against the provided endpoints.
