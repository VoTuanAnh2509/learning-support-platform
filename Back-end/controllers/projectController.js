// Back-end/controllers/projectController.js (Barrel File)
const authMiddleware = require('../middlewares/authMiddleware');
const authController = require('./authController');
const userController = require('./userController');
const courseController = require('./courseController');
const learningController = require('./learningController');
const aiController = require('./aiController');
const notificationController = require('./notificationController');

module.exports = {
    ...authMiddleware,
    ...authController,
    ...userController,
    ...courseController,
    ...learningController,
    ...aiController,
    ...notificationController,
    notFound: (_req, res) => res.status(404).json({ error: 'Resource not found.' }),
};
