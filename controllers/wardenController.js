// controllers/wardenController.js
const LeaveApplication = require("../models/LeaveApplication");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const fcm = require("../utils/fcm");

// Helper to safely strip sensitive fields before returning
const sanitizeLeave = (leaveDoc) => {
  const obj = leaveDoc.toObject ? leaveDoc.toObject() : leaveDoc;
  delete obj.parentToken;
  return obj;
};

// GET /api/warden/applications
// Supports optional query params: batch, status, startDate, endDate, search
exports.listPending = async (req, res, next) => {
  try {
    const wardenGender = req.user && req.user.gender;
    if (!wardenGender) {
      return res.status(400).json({ success: false, message: "Warden gender not specified in user profile" });
    }

    const { batch, status, startDate, endDate, search } = req.query;
    const hasFilters = batch || status || startDate || endDate || search;

    // If no filters provided, keep previous behaviour: return all leaves for same gender (old endpoint behaviour)
    if (!hasFilters) {
      const leaves = await LeaveApplication.find({})
        .populate("student", "name email batch gender")
        .sort({ "parentStatus.decidedAt": -1 });

      const sameGenderLeaves = leaves.filter((l) => l.student && l.student.gender === wardenGender);
      const safe = sameGenderLeaves.map(sanitizeLeave);
      return res.json({ success: true, count: safe.length, leaves: safe });
    }

    // Build student filter first (apply warden gender always)
    const studentQuery = { role: "student", gender: wardenGender };
    if (batch) studentQuery.batch = Number(batch);
    if (search) studentQuery.name = { $regex: search, $options: "i" };

    const students = await User.find(studentQuery).select("_id");
    const studentIds = students.map((s) => s._id);
    if (studentIds.length === 0) return res.json({ success: true, count: 0, leaves: [] });

    // Build leave query based on selected students and optional filters
    const leaveQuery = { student: { $in: studentIds } };
    if (status && status !== "all") leaveQuery["wardenStatus.status"] = status;

    // Date filters: allow startDate (>=) and endDate (<=)
    const dateConditions = [];
    if (startDate) dateConditions.push({ startDate: { $gte: new Date(startDate) } });
    if (endDate) dateConditions.push({ endDate: { $lte: new Date(endDate) } });
    if (dateConditions.length) leaveQuery.$and = dateConditions;

    const leaves = await LeaveApplication.find(leaveQuery)
      .populate("student", "name email batch gender")
      .sort({ createdAt: -1 });

    const safe = leaves.map(sanitizeLeave);
    return res.json({ success: true, count: safe.length, leaves: safe });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await LeaveApplication.findById(id).populate(
      "student",
      "name email parents batch gender"
    );

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    // if (leave.adminStatus.status === 'stopped') {
    //   return res.status(403).json({ message: 'This request has been cancelled by the administration.' });
    // }
    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

// Make sure to import LeaveApplication, User, and sendEmail at the top of your wardenController.js
// const LeaveApplication = require('../models/LeaveApplication');
// const User = require('../models/User');
// const sendEmail = require('../utils/sendEmail');

// Reusable email template for rejection/cancellation (copy this if not already shared)
const generateRejectionEmailHtml = (studentName, role, status, reason) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Leave Application ${
    status.charAt(0).toUpperCase() + status.slice(1)
  }</title>
  <style>
    /* RESET & MOBILE */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse!important; }
    body { margin:0; padding:0; width:100%!important; background:#f4f4f4; font-family:Arial,sans-serif; }
    @media screen and (max-width:600px) {
      .container { width:100%!important; margin:0!important; border-radius:0!important; }
      .mobile-center { text-align:center!important; }
    }
  </style>
</head>
<body style="background:#f4f4f4; padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
          <table width="600" align="center"><tr><td>
        <![endif]-->
        <table class="container" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;
                      box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <!-- HEADER -->
          <tr>
            <td style="background:#800000;padding:20px;text-align:center;">
              <img src="https://media.licdn.com/dms/image/v2/D4E0BAQG03u_JwSSOTg/company-logo_200_200/company-logo_200_200/0/1696437747519?e=2147483647&v=beta&t=Zvu-ZXadz0L420-4VWZNqRWCXn9SWwtH5e2mP1BFmi4"
                   alt="PIMS Logo" width="40" style="vertical-align:middle;margin-right:8px;">
              <span style="color:#fff;font-size:24px;font-weight:bold;vertical-align:middle;">
                PIMS Leave Management
              </span>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="padding:24px;color:#333;">
              <p style="margin-top:0;">Dear Parent,</p>
              <p>
                We regret to inform you that your ward,
                <strong>${studentName}</strong>'s leave application has been
                <strong>${status}</strong> by the ${role}.
              </p>

              ${
                reason
                  ? `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                  <tr>
                    <td style="padding:12px 0;">
                      <div style="font-size:12px;color:#777;text-transform:uppercase;letter-spacing:0.5px;">
                        Reason for ${
                          status.charAt(0).toUpperCase() + status.slice(1)
                        }
                      </div>
                      <div style="font-size:16px;font-weight:500;color:#333;margin-top:4px;">
                        ${reason}
                      </div>
                    </td>
                  </tr>
                </table>
              `
                  : ``
              }

              <p>If you have any questions, please contact the college administration.</p>
              <p>Best regards,<br/>College Administration</p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#666;">
              Prasad Institute of Medical Sciences,<br/>
              Sarai Shahzadi, Banthara, Kanpur Road, Lucknow (U.P) – 226401<br/>
              <a href="https://pimslko.edu.in" style="color:#800000;text-decoration:none;">
                www.pimslko.edu.in
              </a> | +91-9721453166
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
          </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
`;

exports.decide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, rejectionReason } = req.body; // <-- Get optional rejectionReason

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision value" });
    }

    const leave = await LeaveApplication.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if (leave.wardenStatus.status !== "pending") {
      return res.status(409).json({ message: "Warden has already decided." });
    }
    if (leave.adminStatus.status === "stopped") {
      return res.status(403).json({
        message: "This request has been cancelled by the administration.",
      });
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() + 330);

    leave.wardenStatus = {
      status: decision,
      decidedAt: now,
      reason: decision === "rejected" ? rejectionReason : undefined, // <-- Store reason ONLY if rejected
    };
    await leave.save();

    // Send FCM notification to student
    await fcm.sendFcmToUser(
      leave.student,
      "Leave Status Changed",
      `Warden has ${decision} your leave request.`,
      { leaveId: leave._id.toString(), status: decision },
      decision === "approved" ? "warden-approved" : "warden-rejected",
      leave._id
    );

    // Send email to parents if the decision is 'rejected'
    if (decision === "rejected") {
      const student = await User.findById(leave.student); // Fetch student details
      if (student && student.parents && student.parents.length > 0) {
        const emailHtml = generateRejectionEmailHtml(
          student.name,
          "Warden", // Role for Warden
          "rejected", // Status for Warden rejecting
          rejectionReason
        );

        for (let p of student.parents) {
          await sendEmail({
            to: p.email,
            subject: `Important: Leave Application for ${student.name} Rejected by Warden`,
            html: emailHtml,
          });
        }
      }
    }

    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = (req, res) => {
  // req.user comes from your auth middleware
  res.json({ user: req.user });
};

// GET /api/warden/stats
exports.stats = async (req, res, next) => {
  try {
    const wardenGender = req.user && req.user.gender;
    if (!wardenGender) return res.status(400).json({ success: false, message: "Warden gender not specified" });

    const { batch, startDate, endDate } = req.query;

    // Resolve students in scope (warden gender + optional batch)
    const studentQuery = { role: "student", gender: wardenGender };
    if (batch) studentQuery.batch = Number(batch);
    const students = await User.find(studentQuery).select("_id batch");
    const studentIds = students.map((s) => s._id);

    // If no students, return zeroed stats
    if (studentIds.length === 0) {
      return res.json({
        success: true,
        filtersApplied: { batch: batch ? Number(batch) : undefined, startDate, endDate },
        statistics: {
          totalApplications: 0,
          approvedCount: 0,
          rejectedCount: 0,
          pendingCount: 0,
          approvalRate: 0,
          rejectionRate: 0,
          pendingRate: 0,
        },
        batchBreakdown: [],
      });
    }

    const leaveQuery = { student: { $in: studentIds } };
    const andConds = [];
    if (startDate) andConds.push({ startDate: { $gte: new Date(startDate) } });
    if (endDate) andConds.push({ endDate: { $lte: new Date(endDate) } });
    if (andConds.length) leaveQuery.$and = andConds;

    const leaves = await LeaveApplication.find(leaveQuery).populate("student", "batch");

    const totalApplications = leaves.length;
    const approvedCount = leaves.filter((l) => l.wardenStatus && l.wardenStatus.status === "approved").length;
    const rejectedCount = leaves.filter((l) => l.wardenStatus && l.wardenStatus.status === "rejected").length;
    const pendingCount = leaves.filter((l) => !l.wardenStatus || l.wardenStatus.status === "pending").length;

    const pct = (n) => (totalApplications ? Math.round((n / totalApplications) * 1000) / 10 : 0);

    // Batch breakdown
    const breakdownMap = new Map();
    for (const l of leaves) {
      const b = (l.student && l.student.batch) || "unknown";
      if (!breakdownMap.has(b)) breakdownMap.set(b, { batch: b, total: 0, approved: 0, rejected: 0, pending: 0 });
      const entry = breakdownMap.get(b);
      entry.total += 1;
      const st = l.wardenStatus && l.wardenStatus.status;
      if (st === "approved") entry.approved += 1;
      else if (st === "rejected") entry.rejected += 1;
      else entry.pending += 1;
    }

    const batchBreakdown = Array.from(breakdownMap.values());

    res.json({
      success: true,
      filtersApplied: { batch: batch ? Number(batch) : undefined, startDate, endDate },
      statistics: {
        totalApplications,
        approvedCount,
        rejectedCount,
        pendingCount,
        approvalRate: pct(approvedCount),
        rejectionRate: pct(rejectedCount),
        pendingRate: pct(pendingCount),
      },
      batchBreakdown,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/warden/students/:studentId/history
exports.getStudentHistory = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await User.findById(studentId).select("_id name batch gender role");
    if (!student || student.role !== "student") return res.status(404).json({ success: false, message: "Student not found" });

    // Restrict to same gender as warden
    if (req.user && req.user.gender && student.gender !== req.user.gender) {
      return res.status(403).json({ success: false, message: "Forbidden: student outside warden scope" });
    }

    const historyDocs = await LeaveApplication.find({ student: studentId })
      .select("reason startDate endDate wardenStatus createdAt")
      .sort({ startDate: -1 });

    const history = historyDocs.map((h) => ({
      _id: h._id,
      reason: h.reason,
      startDate: h.startDate,
      endDate: h.endDate,
      wardenStatus: h.wardenStatus,
      createdAt: h.createdAt,
    }));

    res.json({ success: true, student: { _id: student._id, name: student.name, batch: student.batch }, history });
  } catch (err) {
    next(err);
  }
};

// GET /api/warden/students?batch=YYYY
exports.listStudents = async (req, res, next) => {
  try {
    const { batch } = req.query;
    const query = { role: "student" };
    // restrict to same gender as warden
    if (req.user && req.user.gender) query.gender = req.user.gender;
    if (batch) query.batch = Number(batch);

    const students = await User.find(query).select("_id name batch").sort({ name: 1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    next(err);
  }
};