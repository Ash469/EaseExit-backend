const express = require("express");
const { checkStudentOutsideStatus } = require("../controllers/whatsappCheckController");

const router = express.Router();

router.post("/", checkStudentOutsideStatus);

module.exports = router;
