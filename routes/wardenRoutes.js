// routes/wardenRoutes.js
const express = require("express");
const { protect, isWarden } = require("../middleware/authMiddleware");
const { ensurePimsEmail } = require("../middleware/emailDomainMiddleware");
const {
  listPending,
  getById,
  decide,
  getProfile,
  stats,
  getStudentHistory,
  listStudents,
} = require("../controllers/wardenController");
const Concern = require("../models/Concern");

const router = express.Router();

// Apply auth + domain‐check to all warden routes
router.use(protect, isWarden, ensurePimsEmail);

// List all parent‐approved, warden‐pending leaves
router.get("/applications", listPending);

// Get full details of one leave by ID
router.get("/applications/:id", getById);

// Approve or reject a pending leave
router.patch("/applications/:id", decide);


router.get("/profile", getProfile);

// New: analytics / stats for warden dashboard
router.get("/stats", stats);

// New: list students (useful for selecting student for history) e.g. /api/warden/students?batch=2024
router.get("/students", listStudents);

// New: student leave history
router.get("/students/:studentId/history", getStudentHistory);


router.get('/concerns', async (req, res, next) => {
  try {
    const concerns = await Concern.find().populate('guard').sort({ createdAt: -1 });
    res.json({ concerns });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
