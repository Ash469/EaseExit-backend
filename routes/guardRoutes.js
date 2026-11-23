// routes/guardRoutes.js
const express = require("express");
const { protect, isGuard } = require("../middleware/authMiddleware");
const {
  listApproved,
  getById,
  decide,
  markReturn,
  listDepartedAwaitingReturn,
  createConcern,
  listAllStudents,
  getProfile
} = require("../controllers/guardController");
const multer  = require("multer");
const upload = multer({ dest: 'uploads/' });
const router = express.Router();

// All guard routes require a valid guard token
router.use(protect, isGuard);

//route to get all the students of college who can go outside and have access to portal this is helper for guard
router.get('/allstudents', listAllStudents);

router.get("/profile",getProfile);

router.get(
  "/applications/departed-awaiting-return",
  listDepartedAwaitingReturn
);

// List warden-approved, guard-pending applications
router.get("/applications", listApproved);

// Get full details of one application
router.get("/applications/:id", getById);

// Final approve/reject
router.patch("/applications/:id", decide);

router.patch("/applications/:id/return", markReturn);

//Apply for a new concern
router.post(
  "/concerns",
  upload.single("document"),
  createConcern
);

module.exports = router;
