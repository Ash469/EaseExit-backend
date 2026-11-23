// routes/leaveRoutes.js
const express            = require('express');
const multer             = require('multer');
const { protect, isParent }        = require('../middleware/authMiddleware');
const {
  applyLeave,
  listLeaves,
  getLeaveById
} = require('../controllers/leaveController');

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

// All leave routes require a student token
router.use(protect);

// List all of this student’s leaves
router.get('/', listLeaves);

// Get details for one leave
router.get('/:id', (req, res, next) => {
  // Allow if user is student or parent
  if (req.user && (req.user.role === 'student')) {
    return getLeaveById(req, res, next);
  }
  // If parent, run isParent middleware first
  isParent(req, res, (err) => {
    if (err) return; // isParent will handle the response if not allowed
    return getLeaveById(req, res, next);
  });
});

// Apply for a new leave
router.post('/', upload.single('document'), applyLeave);

module.exports = router;
