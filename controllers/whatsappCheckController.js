const crypto = require("crypto");
const User = require("../models/User");
const LeaveApplication = require("../models/LeaveApplication");

const hashSecret = (rawSecret) =>
  crypto.createHash("sha256").update(String(rawSecret)).digest("hex");

const compareSecretHash = (providedHash, expectedHash) => {
  if (!providedHash || !expectedHash) return false;

  const provided = Buffer.from(String(providedHash));
  const expected = Buffer.from(String(expectedHash));

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
};

exports.checkStudentOutsideStatus = async (req, res, next) => {
  try {
    const { email, hashedSecretKey } = req.body;

    if (!email || !hashedSecretKey) {
      return res.status(400).json({
        message: "email and hashedSecretKey are required",
      });
    }

    const serverSecret = process.env.WHATSAPP_CHECK_SECRET;
    if (!serverSecret) {
      return res.status(500).json({
        message: "Server is missing WHATSAPP_CHECK_SECRET configuration",
      });
    }

    const expectedHash = hashSecret(serverSecret);

    const isSecretValid = compareSecretHash(hashedSecretKey, expectedHash);
    if (!isSecretValid) {
      return res.status(401).json({
        message: "Invalid secret",
      });
    }

    const student = await User.findOne({
      email: String(email).toLowerCase().trim(),
      role: "student",
    }).select("_id");

    if (!student) {
      return res.json({ isOutside: false });
    }

    const outsideLeave = await LeaveApplication.findOne({
      student: student._id,
      "guardStatus.status": "approved",
      "adminStatus.status": { $ne: "stopped" },
      $or: [{ returnDateTime: { $exists: false } }, { returnDateTime: null }],
    })
      .sort({ "guardStatus.decidedAt": -1 })
      .select("_id");

    return res.json({ isOutside: Boolean(outsideLeave) });
  } catch (err) {
    return next(err);
  }
};
