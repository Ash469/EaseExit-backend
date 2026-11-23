// controllers/adminController.js

const LeaveApplication = require("../models/LeaveApplication");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const fcm = require("../utils/fcm");

// 1. Overall stats
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow= new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
    const start7         = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const [totalStudents, facetArr] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      LeaveApplication.aggregate([
        {
          $addFields: {
            durationDays: {
              $divide: [{ $subtract: ['$endDate', '$startDate'] }, 86_400_000] // ms->days
            }
          }
        },
        {
          $facet: {
            totalLeaves: [{ $count: 'count' }],

            byParent: [{ $group: { _id: '$parentStatus.status', count: { $sum: 1 } } }],
            byWarden: [{ $group: { _id: '$wardenStatus.status', count: { $sum: 1 } } }],
            byGuard:  [{ $group: { _id: '$guardStatus.status',  count: { $sum: 1 } } }],
            byAdmin:  [{ $group: { _id: '$adminStatus.status',  count: { $sum: 1 } } }],

            withDocs: [
              { $match: { documentUrl: { $exists: true, $ne: null, $ne: '' } } },
              { $count: 'count' }
            ],

            activeNow: [
              { $match: { startDate: { $lte: now }, endDate: { $gte: now } } },
              { $count: 'count' }
            ],

            today: [
              { $match: { createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } },
              { $count: 'count' }
            ],

            thisMonth: [
              { $match: { createdAt: { $gte: startOfMonth, $lt: startOfTomorrow } } },
              { $count: 'count' }
            ],

            avgDuration: [{ $group: { _id: null, avg: { $avg: '$durationDays' } } }],

            fullyApproved: [
              { $match: {
                  'parentStatus.status': 'approved',
                  'wardenStatus.status': 'approved',
                  'guardStatus.status' : 'approved',
                  'adminStatus.status' : { $ne: 'stopped' }
              }},
              { $count: 'count' }
            ],

            rejectedAny: [
              { $match: {
                  $or: [
                    { 'parentStatus.status': 'rejected' },
                    { 'wardenStatus.status': 'rejected' },
                    { 'guardStatus.status' : 'rejected' },
                    { 'adminStatus.status' : 'stopped' }
                  ]
              }},
              { $count: 'count' }
            ],

            trend7: [
              { $match: { createdAt: { $gte: start7 } } },
              { $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  count: { $sum: 1 }
              }},
              { $sort: { _id: 1 } }
            ]
          }
        }
      ])
    ]);

    const ag = facetArr[0] || {};
    const toCount = a => (a && a[0] ? a[0].count : 0);
    const toAvg   = a => (a && a[0] ? Number(a[0].avg.toFixed(1)) : 0);
    const mapCounts = (arr, base = {}) =>
      ({ ...base, ...(arr || []).reduce((o, x) => (o[x._id] = x.count, o), {}) });

    // ----- NEW: movement lists -----
    const [leftTodayList, returnedTodayList, outsideNowList] = await Promise.all([
      // Left today = guard approved today
      LeaveApplication.find({
        "guardStatus.status": "approved",
        "guardStatus.decidedAt": { $gte: startOfToday, $lt: startOfTomorrow }
      })
      .populate({ path: "student", select: "name email batch gender" })
      .sort({ "guardStatus.decidedAt": -1 })
      .lean(),

      // Came inside today = actually returned today
      LeaveApplication.find({
        returnDateTime: { $gte: startOfToday, $lt: startOfTomorrow },
        "guardStatus.status": "approved"
      })
      .populate({ path: "student", select: "name email batch gender" })
      .sort({ returnDateTime: -1 })
      .lean(),

      // Still outside now = left at some point, no return yet
      LeaveApplication.find({
        "guardStatus.status": "approved",
        $or: [{ returnDateTime: { $exists: false } }, { returnDateTime: null }]
      })
      .populate({ path: "student", select: "name email batch gender" })
      .sort({ "guardStatus.decidedAt": -1 })
      .lean()
    ]);

    const simplify = (l) => ({
      _id: l._id,
      student: l.student ? {
        name: l.student.name,
        email: l.student.email,
        batch: l.student.batch,
        gender: l.student.gender,
      } : null,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      documentUrl: l.documentUrl || null,
      outAt: l.guardStatus?.decidedAt || null,
      returnedAt: l.returnDateTime || null,
      parentStatus: l.parentStatus,
      wardenStatus: l.wardenStatus,
      guardStatus: l.guardStatus,
      adminStatus: l.adminStatus
    });

    // normalize 7-day trend (existing)
    const trendMap = new Map((ag.trend7 || []).map(d => [d._id, d.count]));
    const trend7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend7.push({ date: key, count: trendMap.get(key) || 0 });
    }

    res.json({
      totalStudents,
      totalLeaves: toCount(ag.totalLeaves),

      leavesByParentStatus: mapCounts(ag.byParent, { pending: 0, approved: 0, rejected: 0 }),
      leavesByWardenStatus: mapCounts(ag.byWarden, { pending: 0, approved: 0, rejected: 0 }),
      leavesByGuardStatus : mapCounts(ag.byGuard , { pending: 0, approved: 0, rejected: 0 }),
      leavesByAdminStatus : mapCounts(ag.byAdmin , { pending: 0, stopped: 0 }),

      withDocs: toCount(ag.withDocs),
      activeNow: toCount(ag.activeNow),
      today: toCount(ag.today),
      thisMonth: toCount(ag.thisMonth),
      avgDurationDays: toAvg(ag.avgDuration),
      fullyApproved: toCount(ag.fullyApproved),
      rejectedAny: toCount(ag.rejectedAny),

      trend7,

      // ----- NEW: movement snapshot -----
      movements: {
        leftToday:     { count: leftTodayList.length,     items: leftTodayList.map(simplify) },
        returnedToday: { count: returnedTodayList.length, items: returnedTodayList.map(simplify) },
        outsideNow:    { count: outsideNowList.length,    items: outsideNowList.map(simplify) },
      }
    });
  } catch (err) {
    next(err);
  }
};

// 2. List all applications
exports.listApplications = async (req, res, next) => {
  try {
    const leaves = await LeaveApplication.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "student",
        select: "name email parents batch gender",
      });

    const safe = leaves.map((l) => {
      const obj = l.toObject();
      delete obj.parentToken;
      return obj;
    });

    res.json({ leaves: safe });
  } catch (err) {
    next(err);
  }
};

// 3. Get a single application by ID
exports.getApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await LeaveApplication.findById(id)
      .populate("student", "name email parents")
      .lean();
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

const generateRejectionEmailHtml = (studentName, role, status, reason) => {
  // status is e.g. "rejected" or "stopped"
  const capStatus = status.charAt(0).toUpperCase() + status.slice(1);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>PIMS Leave Application ${capStatus}</title>
  <style>
    /* === RESET & MOBILE === */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse !important; }
    body { margin:0; padding:0; width:100% !important; background-color:#f4f4f4; font-family:Arial,sans-serif; }
    @media screen and (max-width:600px) {
      .container { width:100% !important; padding:0 !important; }
      .mobile-center { text-align:center !important; }
    }
  </style>
</head>
<body style="background-color:#f4f4f4; padding:20px;">
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
              <img src="https://ci3.googleusercontent.com/meips/ADKq_NZmB0U-GI9GaYywmjxG8Hs4ny7X5ngVVVON7EqOeWNGMpFq30hZzDfXIfmwfrN9hQD_KeMi137OGkwPCokyU09nuk0oNs06zX31-yoZdQ4ajLhQNwflHRLei4xXCX0UI3qH7JQUtokuEGbQNPfO-IGlZBeyg4xyZJmW5Ni3ivWda4DiwMkcYwlR-1-EUt_oFToynsoThEPMZ8_gKQZ_B3X9p99nTxtnQ9mzxWioNFf5WYHiChunlhsz0_AmaeZVOO8UNhLu3IGec4zP=s0-d-e1-ft#https://media.licdn.com/dms/image/v2/D4E0BAQG03u_JwSSOTg/company-logo_200_200/company-logo_200_200/0/1696437747519?e=2147483647&v=beta&t=Zvu-ZXadz0L420-4VWZNqRWCXn9SWwtH5e2mP1BFmi4"
                   alt="PIMS Logo" width="40"
                   style="vertical-align:middle;margin-right:8px;">
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
                <strong>${studentName}</strong>’s leave application
                has been <strong>${capStatus.toLowerCase()}</strong> by the ${role}.
              </p>
              ${reason ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-top:1px solid #eee;padding-top:12px;">
                    <div style="font-size:12px;color:#777;text-transform:uppercase;">Reason for ${capStatus}</div>
                    <div style="font-size:16px;font-weight:500;">${reason}</div>
                  </td>
                </tr>
              </table>
              ` : ``}
              <p>
                If you have any questions, please reach out to the college administration.
              </p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0;padding:16px;text-align:center;
                       font-size:12px;color:#666;">
              Prasad Institute of Medical Sciences, Sarai Shahzadi, Banthara,
              Kanpur Road, Lucknow (U.P) – 226401<br>
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
};


// 4. Stop/cancel an application
exports.stopApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, cancellationReason } = req.body; // <-- Get optional cancellationReason

    if (action !== "stop") {
      return res.status(400).json({ message: "Invalid action" });
    }

    const leave = await LeaveApplication.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if(leave.guardStatus.status === "approved" || leave.guardStatus.status === "rejected" || leave.wardenStatus.status === "rejected") {
      return res.status(400).json({
        message: "Cannot stop leave application that has already been processed by guard or warden.",
      });
    }

    leave.adminStatus = {
      status: "stopped",
      decidedAt: Date.now(),
      reason: cancellationReason, // <-- Store the reason
    };
    await leave.save();

    // Send email to parents about the cancellation
    const student = await User.findById(leave.student);
    if (student && student.parents && student.parents.length > 0) {
      const emailHtml = generateRejectionEmailHtml(
        student.name,
        "Administration", // Role for Admin
        "cancelled", // Status for Admin stopping
        cancellationReason
      );

      for (let p of student.parents) {
        await sendEmail({
          to: p.email,
          subject: `Urgent: Leave Application for ${student.name} Cancelled`,
          html: emailHtml,
        });
      }
    }

    // FCM to student
    await fcm.sendFcmToUser(
      leave.student,
      "Leave Cancelled",
      "Your leave request has been cancelled by the administration.",
      { leaveId: leave._id.toString(), status: "cancelled" },
      "leave-status-changed",
      leave._id
    );

    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = (req, res) => {
  // req.user comes from your auth middleware
  res.json({ user: req.user });
}

/**
 * Admin-only: update user fields safely.
 * Accepts: name, email, role, batch, gender, parents[]
 * Also accepts legacy single parent fields: parentName + parentEmail
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Build $set / $unset payloads (so we can "clear" fields when role changes)
    const $set = {};
    const $unset = {};

    // Helpers
    const has = (k) => Object.prototype.hasOwnProperty.call(req.body, k);
    const lower = (v) => (typeof v === "string" ? v.toLowerCase() : v);
    const trim = (v) => (typeof v === "string" ? v.trim() : v);

    // Allowed top-level fields
    if (has("name")) $set.name = trim(req.body.name);
    if (has("email")) $set.email = lower(trim(req.body.email));
    if (has("role")) $set.role = req.body.role;
    if (has("gender")) $set.gender = req.body.gender;

    // Batch (number or clear)
    if (has("batch")) {
      const b = req.body.batch;
      if (b === null || b === "" || typeof b === "undefined") {
        $unset.batch = "";
      } else {
        $set.batch = Number(b);
      }
    }

    // Parents: prefer array; gracefully accept legacy single fields
    if (has("parents")) {
      if (!Array.isArray(req.body.parents)) {
        return res.status(400).json({ message: "parents must be an array" });
      }
      $set.parents = req.body.parents.map((p) => ({
        name: trim(p?.name || ""),
        email: lower(trim(p?.email || "")),
      }));
    } else if (has("parentName") || has("parentEmail")) {
      const pName = trim(req.body.parentName || "");
      const pEmail = lower(trim(req.body.parentEmail || ""));
      if (pName && pEmail) {
        $set.parents = [{ name: pName, email: pEmail }];
      } else if (pName || pEmail) {
        return res
          .status(400)
          .json({ message: "Provide both parentName and parentEmail together" });
      }
    }

    // Role-based cleanup: if role changed away from student, clear batch/parents
    if ($set.role && $set.role !== "student") {
      $unset.batch = "";
      $set.parents = [];
    }

    // Perform update
    const update = Object.keys($unset).length
      ? { $set, $unset }
      : { $set };

    const user = await User.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    // Duplicate email
    if (err && err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).json({ message: "Email already exists" });
    }
    next(err);
  }
};