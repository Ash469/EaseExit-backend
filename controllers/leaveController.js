// controllers/leaveController.js
const LeaveApplication = require("../models/LeaveApplication");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const cloudinary = require("../utils/cloudinary");
const fcm = require("../utils/fcm");
const { uploadToDrive } = require("../utils/drive");
const clearUploads = require("../utils/clearUploads");
exports.listLeaves = async (req, res, next) => {
  try {
    const leaves = await LeaveApplication.find({ student: req.user._id })
      .sort({
        createdAt: -1,
      })
      .populate("student");

    // Manipulate each leave object to add a +5:30 offset to createdAt
    const adjustedLeaves = leaves.map((leave) => {
      // Create a new Date object from the original createdAt
      const originalDate = new Date(leave.createdAt);
      const updatedDate = new Date(leave.updatedAt);

      // Add 5 hours and 30 minutes (330 minutes) to the time
      originalDate.setMinutes(originalDate.getMinutes() + 330);
      updatedDate.setMinutes(updatedDate.getMinutes() + 330);

      // Return a new object with the modified createdAt
      return {
        ...leave.toObject(), // Use .toObject() to get a plain JavaScript object
        createdAt: originalDate,
        updatedAt: updatedDate,
      };
    });

    res.json({ leaves: adjustedLeaves });
  } catch (err) {
    next(err);
  }
};

exports.getLeaveById = async (req, res, next) => {
  try {
    // If parent, use studentId from req.user; else use user's own _id
    const studentId = req.user.role === 'parent' ? req.user.studentId : req.user._id;
    const leave = await LeaveApplication.findOne({
      _id: req.params.id,
      student: studentId,
    });
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }
    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

exports.applyLeave = async (req, res, next) => {
  try {
    const { startDate, endDate, reason, returnDateTime } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    console.log(
      `[applyLeave] raw startDate=${JSON.stringify(startDate)} endDate=${JSON.stringify(endDate)} parsedStart=${start} parsedEnd=${end} diffDays=${diffDays}`
    );
    if (diffDays > 10) {
      return res.status(400).json({
        message: `Leave cannot exceed 10 days. Your application is for ${diffDays} days.`,
      });
    }

    let documentUrl = null;
    if (req.file) {
      documentUrl = await uploadToDrive(
        req.file.path,
        req.file.originalname,
        req.file.mimetype
      );
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() + 330);

    const leave = await LeaveApplication.create({
      student: req.user._id,
      startDate,
      endDate,
      reason,
      documentUrl,
      createdAt: now,
      updatedAt: now,
      ...(returnDateTime ? { returnDateTime: new Date(returnDateTime) } : {}),
    });

    // Prepare styled email for parents
    const student = await User.findById(req.user._id);
    const baseUrl = process.env.BACKEND_URL;
    const link = `${baseUrl}api/parent/decision?token=${leave.parentToken}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PIMS Leave Request</title>
  <style>
    /* === RESET & MOBILE === */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse !important; }
    body { margin:0; padding:0; width:100% !important; background-color:#f4f4f4; }
    @media screen and (max-width:600px) {
      .container { width:100% !important; padding:0 !important; }
      .mobile-center { text-align:center !important; }
    }
  </style>
</head>
<body style="font-family:Arial,sans-serif; background-color:#f4f4f4; padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table width="600" align="center"><tr><td>
        <![endif]-->
        <table class="container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <!-- HEADER -->
          <tr>
            <td style="background:#800000; padding:20px; text-align:center;">
              <img src="https://media.licdn.com/dms/image/v2/D4E0BAQG03u_JwSSOTg/company-logo_200_200/company-logo_200_200/0/1696437747519?e=2147483647&v=beta&t=Zvu-ZXadz0L420-4VWZNqRWCXn9SWwtH5e2mP1BFmi4" alt="PIMS Logo" width="40" style="vertical-align:middle; margin-right:8px;">
              <span style="color:#fff; font-size:24px; font-weight:bold; vertical-align:middle;">
                PIMS Leave Management
              </span>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="padding:24px; color:#333;">
              <p style="margin-top:0;">Dear Parent,</p>
              <p>
                A new leave request has been submitted by 
                <strong>${student.name}</strong> (PIMS Student).
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-top:1px solid #eee; padding-top:12px;">
                    <div style="font-size:12px; color:#777; text-transform:uppercase;">Dates</div>
                    <div style="font-size:16px; font-weight:500;">
                      ${new Date(startDate).toLocaleString()} &rarr; ${new Date(
      endDate
    ).toLocaleString()}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #eee; padding:12px 0;">
                    <div style="font-size:12px; color:#777; text-transform:uppercase;">Reason</div>
                    <div style="font-size:16px; font-weight:500;">${reason}</div>
                  </td>
                </tr>
              </table>
              <p style="text-align:center;">
                <a 
                  href="${link}" 
                  style="
                    display:inline-block;
                    background:#800000; 
                    color:#fff !important; 
                    text-decoration:none; 
                    padding:12px 24px; 
                    border-radius:4px;
                    font-weight:600;
                  "
                >
                  View &amp; Respond
                </a>
              </p>
              <p style="font-size:12px; color:#555; text-align:center; margin-bottom:0;">
                If you did not expect this, please ignore.
              </p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0; padding:16px; text-align:center; font-size:12px; color:#666;">
              Prasad Institute of Medical Sciences, Sarai Shahzadi, Banthara, Kanpur Road, Lucknow (U.P) - 226401<br>
              <a href="https://pimslko.edu.in" style="color:#800000; text-decoration:none;">www.pimslko.edu.in</a> | +91-9721453166
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

    // Send to each parent (email)
    for (let p of student.parents) {
      await sendEmail({
        to: p.email,
        subject: `Leave Approval Needed for ${student.name}`,
        html: emailHtml,
      });
      // Send FCM notification to parent
      await fcm.sendFcmToUser(
        p._id,
        "Leave Request",
        `${student.name} has applied for leave.`,
        { leaveId: leave._id.toString() },
        "leave-request",
        leave._id
      );
    }
    leave.parentToken = null;
    clearUploads();
    res.status(201).json({ leave });
  } catch (err) {
    next(err);
  }
};
