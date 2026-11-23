// routes/adminRoutes.js
const express           = require('express');
const { isAdmin, protect }       = require('../middleware/authMiddleware');
const {
  getStats,
  listApplications,
  getApplicationById,
  stopApplication,
  getProfile,
  updateUser
} = require('../controllers/adminController');
const Concern = require('../models/Concern');
const { get } = require('mongoose');

const router = express.Router();

// all routes require admin token
router.use(protect , isAdmin);

// Stats
router.get('/stats', getStats);

// List all leave requests
router.get('/applications', listApplications);

// Get full details of one request
router.get('/applications/:id', getApplicationById);

// Stop (cancel) a request
router.patch('/applications/:id', stopApplication);


router.get('/profile', getProfile);


// Edit (update) a user by ID  —  PATCH /api/admin/users/:id
router.patch('/users/:id', updateUser);

// List all concerns
router.get('/concerns', async (req, res, next) => {
  try {
    const concerns = await Concern.find().populate('guard').sort({ createdAt: -1 });
    res.json({ concerns });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
