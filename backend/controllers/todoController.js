const db = require('../config/db');

// Create a to-do item
exports.createTodo = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, title, description, priority = 'medium', dueDate } = req.body;

        // Validate required fields
        if (!projectId || !title) {
            return res.status(400).json({
                success: false,
                message: 'Project ID and title are required'
            });
        }

        // Verify the project belongs to the user (not others)
        const [projects] = await db.query(
            'SELECT id FROM projects WHERE id = ? AND user_id = ?',
            [projectId, userId]
        );

        if (projects.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Project not found or you do not have permission'
            });
        }

        // Insert to-do item
        const [result] = await db.query(
            'INSERT INTO to_do_items (user_id, project_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, projectId, title, description || null, priority, dueDate || null]
        );

        res.status(201).json({
            success: true,
            message: 'To-do item created successfully',
            data: { todoId: result.insertId }
        });
    } catch (error) {
        console.error('Error creating to-do item:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating to-do item',
            error: error.message
        });
    }
};

// Get all to-do items for a user
exports.getUserTodos = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, status } = req.query;

        let query = `
            SELECT t.*, p.name as project_name 
            FROM to_do_items t
            JOIN projects p ON t.project_id = p.id
            WHERE t.user_id = ?
        `;
        const params = [userId];

        if (projectId) {
            query += ' AND t.project_id = ?';
            params.push(projectId);
        }

        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        }

        query += ' ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC';

        const [todos] = await db.query(query, params);

        res.json({
            success: true,
            data: todos,
            count: todos.length
        });
    } catch (error) {
        console.error('Error fetching to-do items:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching to-do items',
            error: error.message
        });
    }
};

// Get to-do items for a specific project
exports.getProjectTodos = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;

        // Verify project belongs to user
        const [projects] = await db.query(
            'SELECT id FROM projects WHERE id = ? AND user_id = ?',
            [projectId, userId]
        );

        if (projects.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Project not found or you do not have permission'
            });
        }

        const [todos] = await db.query(
            `SELECT * FROM to_do_items 
             WHERE user_id = ? AND project_id = ?
             ORDER BY due_date ASC, priority DESC, created_at DESC`,
            [userId, projectId]
        );

        res.json({
            success: true,
            data: todos,
            count: todos.length
        });
    } catch (error) {
        console.error('Error fetching project to-do items:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching project to-do items',
            error: error.message
        });
    }
};

// Update a to-do item
exports.updateTodo = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { todoId } = req.params;
        const { title, description, status, priority, dueDate } = req.body;

        // Verify ownership
        const [todos] = await db.query(
            'SELECT * FROM to_do_items WHERE id = ? AND user_id = ?',
            [todoId, userId]
        );

        if (todos.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'To-do item not found or you do not have permission'
            });
        }

        // Build update query
        const updates = [];
        const params = [];

        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }
        if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
        if (dueDate !== undefined) { updates.push('due_date = ?'); params.push(dueDate); }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(todoId, userId);

        const query = `UPDATE to_do_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;

        const [result] = await db.query(query, params);

        res.json({
            success: true,
            message: 'To-do item updated successfully'
        });
    } catch (error) {
        console.error('Error updating to-do item:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating to-do item',
            error: error.message
        });
    }
};

// Delete a to-do item
exports.deleteTodo = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { todoId } = req.params;

        const [result] = await db.query(
            'DELETE FROM to_do_items WHERE id = ? AND user_id = ?',
            [todoId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'To-do item not found or you do not have permission'
            });
        }

        res.json({
            success: true,
            message: 'To-do item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting to-do item:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting to-do item',
            error: error.message
        });
    }
};
