const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const { verifyToken } = require('../middleware/auth');

// To-do routes (all protected)
router.post('/', verifyToken, todoController.createTodo);
router.get('/', verifyToken, todoController.getUserTodos);
router.get('/project/:projectId', verifyToken, todoController.getProjectTodos);
router.patch('/:todoId', verifyToken, todoController.updateTodo);
router.delete('/:todoId', verifyToken, todoController.deleteTodo);

module.exports = router;
