// controllers/parentController.js
const User = require("../models/User");
const LeaveApplication = require("../models/LeaveApplication");
const fcm = require("../utils/fcm");
const now     = new Date();
const utcMs   = now.getTime() + now.getTimezoneOffset() * 60_000;    // convert local→UTC
const istMs   = utcMs + 5.5 * 60 * 60_000; // IST offset
// PIMS‐branded HTML wrapper
const htmlWrapper = (body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>PIMS Leave Approval</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"/>
  <style>
    /* RESET */
    * { box-sizing:border-box; margin:0; padding:0; }
    html, body { height:100%; }
    body { font-family:'Poppins',sans-serif; background:#f0f4f8;
      display:flex; align-items:center; justify-content:center; padding:20px; }

    /* CONTAINER */
    .card {
      background:#fff;
      border-radius:12px;
      box-shadow:0 8px 24px rgba(0,0,0,0.1);
      max-width:500px; width:100%;
      overflow:hidden;
      text-align:center;
      transition:transform .2s;
    }
    .card:hover { transform:translateY(-4px); }

    /* HEADER */
    .card-header {
      background:#002855;
      color:#fff;
      padding:16px;
      display:flex; align-items:center; justify-content:center;
    }
    .card-header img {
      height:32px; margin-right:12px;
    }
    .card-header h1 {
      font-size:1.5rem; font-weight:600;
    }

    /* BODY */
    .card-body {
      padding:24px 32px;
      color:#333;
    }
    .card-body h2 {
      font-size:1.25rem;
      color:#002855;
      margin-bottom:16px;
      font-weight:500;
    }
    .card-body p {
      margin:12px 0;
      font-size:1rem;
      line-height:1.5;
      color:#555;
    }
    .card-body p strong {
      color:#111;
    }
    .info-row {
      text-align:left;
      margin:16px 0;
    }
    .info-label {
      font-size:0.75rem;
      text-transform:uppercase;
      color:#999;
      margin-bottom:4px;
    }
    .info-value {
      font-size:1rem;
      color:#222;
      font-weight:500;
    }

    /* BUTTONS */
    .actions {
      display:flex; gap:12px; margin-top:24px;
      flex-wrap:wrap; justify-content:center;
    }
    .btn {
      flex:1; min-width:120px;
      padding:12px 0;
      border:none; border-radius:6px;
      font-size:0.95rem; font-weight:600;
      cursor:pointer; transition:background .2s, transform .2s;
      color:#fff;
    }
    .btn-approve {
      background:#28a745;
    }
    .btn-approve:hover {
      background:#218838; transform:translateY(-2px);
    }
    .btn-reject {
      background:#dc3545;
    }
    .btn-reject:hover {
      background:#c82333; transform:translateY(-2px);
    }

    /* STATUS MESSAGE */
    .status {
      margin-top:24px;
      padding:16px;
      border-radius:6px;
      font-weight:500;
      font-size:1rem;
      color:#fff;
      display:inline-block;
    }
    .status-success { background:#28a745; }
    .status-danger  { background:#dc3545; }

    /* FOOTER */
    .card-footer {
      background:#f5f8fa;
      font-size:0.75rem; color:#666;
      padding:16px;
      text-align:center;
    }

    /* RESPONSIVE */
    @media (max-width:480px) {
      .card-body { padding:16px; }
      .actions { flex-direction:column; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <img src="https://media.licdn.com/dms/image/v2/D4E0BAQG03u_JwSSOTg/company-logo_200_200/company-logo_200_200/0/1696437747519?e=2147483647&v=beta&t=Zvu-ZXadz0L420-4VWZNqRWCXn9SWwtH5e2mP1BFmi4"
           alt="PIMS Logo"/>
      <h1>PIMS Leave Management</h1>
    </div>
    ${body}
    <div class="card-footer">
      Prasad Institute of Medical Sciences, Sarai Shahzadi, Banthara, Kanpur Road, Lucknow (U.P) – 226401<br/>
      <a href="https://pimslko.edu.in" style="color:#002855; text-decoration:none;">www.pimslko.edu.in</a> | +91-9721453166
    </div>
  </div>
</body>
</html>
`;

exports.showForm = async (req, res, next) => {
  try {
    const { token } = req.query;
    const leave = await LeaveApplication.findOne({
      parentToken: token,
    }).populate("student", "name");

    // Already responded?
    if (leave?.parentStatus?.status !== "pending") {
      const st = leave.parentStatus.status;
      const dt = new Date(leave.parentStatus.decidedAt).toLocaleDateString(
        "en-IN",
        { day: "numeric", month: "long", year: "numeric" , hour: '2-digit', minute: '2-digit' }
      );
      return res.send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Already Responded</h2>
          <p>You <strong>${st}</strong> this request on ${dt}.</p>
          <div class="status ${
            st === "approved" ? "status-success" : "status-danger"
          }">
            Request ${st}
          </div>
        </div>
      `)
      );
    }

    // Cancelled by admin?
    if (!leave || leave.adminStatus?.status === "stopped") {
      return res.send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Request Cancelled</h2>
          <p>This leave request has been cancelled by the administration.</p>
          <div class="status status-danger">No action required</div>
        </div>
      `)
      );
    }

    // Show form
    const sd = new Date(leave.startDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: '2-digit',
      minute: '2-digit'
    });
    const ed = new Date(leave.endDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: '2-digit',
      minute: '2-digit'
    });

    return res.send(
      htmlWrapper(`
      <div class="card-body">
        <h2>Approve Leave Request</h2>
        <div class="info-row">
          <div class="info-label">Student</div>
          <div class="info-value">${leave.student.name}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Dates</div>
          <div class="info-value">${sd} → ${ed}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Reason</div>
          <div class="info-value">${leave.reason}</div>
        </div>
        <form method="POST" action="/api/parent/decision">
          <input type="hidden" name="token" value="${token}"/>
          <div class="actions">
            <button type="submit" name="decision" value="approved" class="btn btn-approve">Approve</button>
            <button type="submit" name="decision" value="rejected"  class="btn btn-reject">Reject</button>
          </div>
        </form>
      </div>
    `)
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send(
      htmlWrapper(`
      <div class="card-body">
        <h2>Error</h2>
        <p>Unable to load the leave request. Please try again later.</p>
        <div class="status status-danger">Server Error</div>
      </div>
    `)
    );
  }
};

exports.submitDecision = async (req, res, next) => {
  try {
    const { token, decision } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Invalid Action</h2>
          <p>Please click one of the buttons to Approve or Reject.</p>
          <div class="status status-danger">Invalid Decision</div>
        </div>
      `)
      );
    }

    const leave = await LeaveApplication.findOne({ parentToken: token });
    if (!leave) {
      return res.status(404).send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Link Expired</h2>
          <p>This link is no longer valid. Please contact administration.</p>
          <div class="status status-danger">Invalid Link</div>
        </div>
      `)
      );
    }
    if (leave.adminStatus?.status === "stopped") {
      return res.status(403).send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Request Cancelled</h2>
          <p>The administration has cancelled this request.</p>
          <div class="status status-danger">Cancelled</div>
        </div>
      `)
      );
    }
    if (leave.parentStatus.status !== "pending") {
      const st = leave.parentStatus.status;
      const dt = new Date(leave.parentStatus.decidedAt).toLocaleDateString(
        "en-IN",
        { day: "numeric", month: "long", year: "numeric" , hour: '2-digit', minute: '2-digit' }
      );
      return res.send(
        htmlWrapper(`
        <div class="card-body">
          <h2>Already Responded</h2>
          <p>You already <strong>${st}</strong> on ${dt}.</p>
          <div class="status ${
            st === "approved" ? "status-success" : "status-danger"
          }">Request ${st}</div>
        </div>
      `)
      );
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + 330);

    // Save and confirm - mark as done from website
    leave.parentStatus = { 
      status: decision, 
      decidedAt: now,
      isDoneFromWebsite: true  // Decision made from website link
    };
    await leave.save();

    // FCM to student
    await fcm.sendFcmToUser(
      leave.student,
      "Parent Decision",
      `Your parent has ${decision} your leave request.`,
      { leaveId: leave._id.toString(), status: decision },
      decision === "approved" ? "parent-approved" : "parent-rejected",
      leave._id
    );

    return res.send(
      htmlWrapper(`
      <div class="card-body">
        <h2>${decision === "approved" ? "Approved ✔" : "Rejected ✖"}</h2>
        <p>You have <strong>${decision}</strong> this request.</p>
        <div class="status ${
          decision === "approved" ? "status-success" : "status-danger"
        }">
          Decision recorded
        </div>
      </div>
    `)
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send(
      htmlWrapper(`
      <div class="card-body">
        <h2>Error</h2>
        <p>Unable to process your decision. Please try again later.</p>
        <div class="status status-danger">Server Error</div>
      </div>
    `)
    );
  }
};

exports.jsonDecision = async (req, res, next) => {
  try {
    const { token, decision } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }

    const leave = await LeaveApplication.findOne({ parentToken: token });
    if (!leave) {
      return res.status(404).json({ message: "Invalid or expired token" });
    }
    if (leave.parentStatus.status !== "pending") {
      return res.status(409).json({ message: "You have already responded." });
    }
    if (leave.adminStatus && leave.adminStatus.status === "stopped") {
      return res.status(403).json({
        message: "This request has been cancelled by the administration.",
      });
    }
const now = new Date();
    now.setMinutes(now.getMinutes() + 330);
    leave.parentStatus = { 
      status: decision, 
      decidedAt: now,
      isDoneFromWebsite: false  // Decision made from mobile app
    };
    await leave.save();

    // FCM to student
    await fcm.sendFcmToUser(
      leave.student,
      "Parent Decision",
      `Your parent has ${decision} your leave request.`,
      { leaveId: leave._id.toString(), status: decision },
      decision === "approved" ? "parent-approved" : "parent-rejected",
      leave._id
    );

    // Send notification to warden of same gender if parent approved
    if (decision === "approved") {
      const student = await User.findById(leave.student).select("gender");
      if (student && student.gender) {
        const warden = await User.findOne({ role: "warden", gender: student.gender });
        if (warden) {
          const Notification = require("../models/Notification");
          await Notification.create({
            recipient: warden._id,
            type: "parent-approved",
            title: "Parent Approved Leave",
            message: `A parent has approved a leave application for a ${student.gender} student.`,
            data: { leaveId: leave._id.toString() },
            read: false,
            createdAt: new Date(istMs), // Use IST time
          });
        }
      }
    }

    res.json({ message: decision });
  } catch (err) {
    next(err);
  }
};

// NEW: Controller to get ward details for an authenticated parent
exports.getWardDetails = async (req, res, next) => {
  try {
    const parentId = req.user._id;
    const wards = await User.find({
      "parents._id": parentId, // <-- FIXED
      role: "student",
    }).select("-password");
    if (!wards || wards.length === 0) {
      return res
        .status(404)
        .json({ message: "No ward found for this parent." });
    }
    res.json({ wards });
  } catch (err) {
    next(err);
  }
};

// NEW: Controller to list all leave applications for an authenticated parent's ward(s)
exports.listWardApplications = async (req, res, next) => {
  try {
    const parentId = req.user._id;
    const wards = await User.find({
      "parents._id": parentId, // <-- FIXED
      role: "student",
    }).select("_id");
    if (!wards || wards.length === 0) {
      return res
        .status(404)
        .json({ message: "No ward found for this parent." });
    }
    const wardIds = wards.map((ward) => ward._id);
    const leaveApplications = await LeaveApplication.find({
      student: { $in: wardIds },
    })
      .populate("student", "name email gender")
      .sort({ createdAt: -1 });
    res.json({ leaves: leaveApplications });
  } catch (err) {
    next(err);
  }
};

// NEW: Controller to get concerns for all wards of an authenticated parent
exports.getWardConcerns = async (req, res, next) => {
  try {
    const parentId = req.user._id;
    const wards = await User.find({
      "parents._id": parentId,
      role: "student",
    }).select("_id");
    if (!wards || wards.length === 0) {
      return res.status(404).json({ message: "No ward found for this parent." });
    }
    const wardIds = wards.map((ward) => ward._id);
    const Concern = require("../models/Concern");
    const concerns = await Concern.find({ studentId: { $in: wardIds } }).sort({ createdAt: -1 });
    res.json({ concerns });
  } catch (err) {
    next(err);
  }
};
