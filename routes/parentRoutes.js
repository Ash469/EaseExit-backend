// routes/parentRoutes.js
const express            = require('express');
const { showForm, submitDecision, jsonDecision , getWardDetails  ,listWardApplications, getWardConcerns } = require('../controllers/parentController');
const { isParent, protect } = require('../middleware/authMiddleware');
const router             = express.Router();
// router.use(protect , isParent);
router.get('/decision', showForm);
router.post('/decision', submitDecision);
router.post('/decision/json', protect , isParent  ,jsonDecision);
router.get('/ward', protect, isParent, getWardDetails);

// NEW: Get all leave applications for the parent's ward (student)
router.get('/applications', protect, isParent, listWardApplications);

// NEW: Get all concerns for the parent's ward(s)
router.get('/concerns', protect, isParent, getWardConcerns);



module.exports = router;