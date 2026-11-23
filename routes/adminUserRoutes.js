const express = require('express');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  bulkUploadStudents,
  bulkDeleteUsers
} = require('../controllers/adminUserController');
const router = express.Router();

// all require admin
router.use(protect, isAdmin);
router.delete('/users/bulk', bulkDeleteUsers);
router.get('/users',            listUsers);
router.get('/users/:id',        getUser);
router.post('/students/bulk',  bulkUploadStudents);
router.post('/users',           createUser);
router.put('/users/:id',        updateUser);
router.delete('/users/:id',     deleteUser);

module.exports = router;
