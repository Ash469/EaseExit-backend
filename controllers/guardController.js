// controllers/guardController.js
const LeaveApplication = require("../models/LeaveApplication");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const cloudinary = require("../utils/cloudinary");
const Concern = require("../models/Concern");
const fcm = require("../utils/fcm");
const { uploadToDrive } = require("../utils/drive");
const clearUploads = require("../utils/clearUploads");

const now     = new Date();
const utcMs   = now.getTime() + now.getTimezoneOffset() * 60_000;    // convert local→UTC
const istMs   = utcMs + 5.5 * 60 * 60_000; 

exports.listApproved = async (req, res, next) => {
  try {
    const leaves = await LeaveApplication.find({
      "wardenStatus.status": "approved",
    }).populate("student", "name email parents batch gender").sort({ "wardenStatus.decidedAt": -1 });

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
    if (leave.adminStatus.status === "stopped") {
      return res.status(403).json({
        message: "This request has been cancelled by the administration.",
      });
    }
    res.json({ leave });
  } catch (err) {
    next(err);
  }
};

const generateRejectionEmailHtml = (studentName, role, status, reason) => {
  const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>PIMS Leave ${capitalized}</title>
  <style>
    /* RESET & MOBILE */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse !important; }
    body { margin:0; padding:0; width:100% !important; background:#f4f4f4; font-family:Arial,sans-serif; }
    @media screen and (max-width:600px) {
      .container { width:100%!important; padding:0!important; }
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
                We regret to inform you that your ward, <strong>${studentName}</strong>, 
                has had their leave application <strong>${status}</strong> by the <strong>${role}</strong>.
              </p>

              ${
                reason
                  ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-top:1px solid #eee;padding-top:12px;">
                    <div style="font-size:12px;color:#777;text-transform:uppercase;">
                      Reason for ${capitalized}
                    </div>
                    <div style="font-size:16px;font-weight:500;">
                      ${reason}
                    </div>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <p>If you have any questions, please contact the college administration.</p>
              <p>Best regards,<br>College Administration</p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#666;">
              Prasad Institute of Medical Sciences, Sarai Shahzadi, Banthara, Kanpur Road, Lucknow (U.P) – 226401<br>
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

exports.decide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, rejectionReason } = req.body; // <-- Get optional rejectionReason from body

    // Validate the decision input
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision value" });
    }

    // Find the leave application by ID
    const leave = await LeaveApplication.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if the leave request has been cancelled by administration
    if (leave.adminStatus.status === "stopped") {
      return res.status(403).json({
        message: "This request has been cancelled by the administration.",
      });
    }

    // Check if the guard has already made a decision for departure
    if (leave.guardStatus.status !== "pending") {
      // Adjusted logic: If guard has already decided and no return date is set, it means they decided on departure.
      // If returnDate is present, it means the student has already returned.
      if (!leave.returnDate) {
        return res
          .status(409)
          .json({ message: "Guard has already decided on departure." });
      } else {
        return res
          .status(409)
          .json({ message: "Student has already returned." });
      }
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + 330);

    // Update the guard status and record the decision time
    leave.guardStatus = {
      status: decision,
      decidedAt: now,
      reason: decision === "rejected" ? rejectionReason : undefined,
    };
    await leave.save();

    const student = await User.findById(leave.student);

    // FCM to student
    await fcm.sendFcmToUser(
      leave.student,
      "Leave Status Changed",
      `Guard has ${decision} your leave request.`,
      { leaveId: leave._id.toString(), status: decision },
      decision === "approved" ? "guard-approved" : "guard-rejected",
      leave._id
    );

    // FCM to parents if approved or return
    if (
      decision === "approved" &&
      student &&
      student.parents &&
      student.parents.length > 0
    ) {
      for (let p of student.parents) {
        await fcm.sendFcmToUser(
          p._id,
          "Guard Approved",
          `Guard has approved ${student.name}'s departure.`,
          { leaveId: leave._id.toString(), status: "approved" },
          "guard-approved",
          leave._id
        );
      }
    }
    // If the leave is approved by the guard, send an email to parents about departure
    if (decision === "approved") {
      // Format the departure date and time for the email
      const departureDateTime = new Date(
        leave.guardStatus.decidedAt
      ).toLocaleString("en-IN", {
       weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      });
      

      // Prepare the styled email for parents about departure
      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PIMS Ward Left Campus Notification</title>
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
            <td style="background:#800000; padding:20px; text-align:center;">
              <img src="https://media.licdn.com/dms/image/v2/D4E0BAQG03u_JwSSOTg/company-logo_200_200/company-logo_200_200/0/1696437747519?e=2147483647&v=beta&t=Zvu-ZXadz0L420-4VWZNqRWCXn9SWwtH5e2mP1BFmi4"
                   alt="PIMS Logo" width="40"
                   style="vertical-align:middle; margin-right:8px;">
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
                We would like to inform you that your ward has left the campus as per their approved leave request.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="border-top:1px solid #eee; padding-top:12px;">
                    <div style="font-size:12px; color:#777; text-transform:uppercase;">Student Name</div>
                    <div style="font-size:16px; font-weight:500;">${student.name}</div>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #eee; padding:12px 0;">
                    <div style="font-size:12px; color:#777; text-transform:uppercase;">Departure Date &amp; Time</div>
                    <div style="font-size:16px; font-weight:500;">${departureDateTime}</div>
                  </td>
                </tr>
              </table>
              <p>
                This notification is to keep you informed about your child's movement.
              </p>
              <p>Best regards,<br>College Administration</p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0; padding:16px; text-align:center; font-size:12px; color:#666;">
              Prasad Institute of Medical Sciences, Sarai Shahzadi, Banthara, Kanpur Road, Lucknow (U.P) – 226401<br>
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

      // Send to each parent
      if (student && student.parents && student.parents.length > 0) {
        for (let p of student.parents) {
          await sendEmail({
            to: p.email,
            subject: `Your Ward ${student.name} Has Left Campus`,
            html: emailHtml,
          });
        }
      }
    } else if (decision === "rejected") {
      // <-- Handle rejection email
      if (student && student.parents && student.parents.length > 0) {
        const emailHtml = generateRejectionEmailHtml(
          student.name,
          "Guard", // Role for Guard
          "rejected", // Status for Guard rejecting
          rejectionReason // Pass the reason to the email template
        );

        for (let p of student.parents) {
          await sendEmail({
            to: p.email,
            subject: `Important: Leave Application for ${student.name} Rejected by Guard`,
            html: emailHtml,
          });
        }
      }
    }

    res.json({ leave }); // Return the updated leave object
  } catch (err) {
    next(err); // Pass any errors to the error handling middleware
  }
};

// controllers/guardController.js

exports.markReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await LeaveApplication.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // only allow once they've actually left (guard approved departure)
    if (leave.guardStatus.status !== "approved") {
      return res.status(400).json({
        message: "Cannot mark return before departure is approved.",
      });
    }

    // prevent double‐marking
    if (leave.returnDateTime) {
      return res.status(409).json({
        message: "Return time has already been recorded.",
      });
    }

    // stamp the return time
    
    const nowUtcMs = Date.now();             // milliseconds since epoch (UTC)
    const istOffsetMs = 330 * 60 * 1000;     // 5h 30m
    const nowIstMs = nowUtcMs + istOffsetMs; // shift ahead to IST wall clock
    const nowIST = new Date(nowIstMs);

    leave.returnDateTime = nowIST; // save IST wall-clock value
    await leave.save();

    // grab student (to email parents)
    const student = await User.findById(leave.student);
    const formatted = new Date(leave.returnDateTime).toLocaleString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC", // <-- key line: prevents adding +5:30 again
    });

    // build & send your PIMS-branded email
    const emailHtml = (student, formattedReturnDateTime) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Ward Returned to Campus</title>
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
              <p>We are pleased to inform you that your ward has safely returned to the campus.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="padding:12px 0;">
                    <div style="font-size:12px;color:#777;text-transform:uppercase;letter-spacing:0.5px;">
                      Student Name
                    </div>
                    <div style="font-size:16px;font-weight:500;color:#333;">
                      ${student.name}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #eee;">
                    <div style="font-size:12px;color:#777;text-transform:uppercase;letter-spacing:0.5px;">
                      Return Date &amp; Time
                    </div>
                    <div style="font-size:16px;font-weight:500;color:#333;">
                      ${formattedReturnDateTime}
                    </div>
                  </td>
                </tr>
              </table>

              <p>Thank you for your cooperation.</p>
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

    // FCM to parents
    for (const p of student.parents) {
      await sendEmail({
        to: p.email,
        subject: `${student.name} has returned to campus.`,
        html: emailHtml(student, formatted),
      });
      await fcm.sendFcmToUser(
        p._id,
        "Ward Returned",
        `${student.name} has returned to campus.`,
        { leaveId: leave._id.toString(), status: "returned" },
        "guard-return",
        leave._id
      );
    }
    // FCM to student
    await fcm.sendFcmToUser(
      student._id,
      "Return Recorded",
      "Your return to campus has been recorded.",
      { leaveId: leave._id.toString(), status: "returned" },
      "student-return",
      leave._id
    );

    return res.json({
      message: "Return time recorded",
      returnDateTime: leave.returnDateTime,
    });
  } catch (err) {
    next(err);
  }
};

exports.listDepartedAwaitingReturn = async (req, res, next) => {
  try {
    // Find leaves where guardStatus is 'approved' and returnDate is null
    const leaves = await LeaveApplication.find({
      "guardStatus.status": "approved",
      returnDateTime: null, // Only get applications where returnDate is not set
    }).populate("student", "name email parents gender batch").sort({ "guardStatus.decidedAt": 1 }); // Populate student details for the frontend

    res.status(200).json({ leaves });
  } catch (err) {
    next(err);
  }
};

exports.createConcern = async (req, res, next) => {
  try {
    const { studentId,studentName, batch, description } = req.body;
    let documentUrl = null;
    if (req.file) {
      documentUrl = await uploadToDrive(
        req.file.path,
        req.file.originalname,
        req.file.mimetype
      );
    }

    // save concern
    const concern = await Concern.create({
      guard: req.user._id,
      studentId,
      studentName,
      batch,
      description,
      documentUrl,
    });
    let imageurl = null;
    if(process.env.NODE_ENV == "production") {
    imageurl = `${process.env.BACKEND_URL}api/drive/${documentUrl}`;
    } else {
      imageurl = `https://college-leave-backend.onrender.com/api/drive/${documentUrl}`;
    }
    // console.log("Concern created:", imageurl);
    // find student (by name+batch) and their parents
    const student = await User.findOne({ name: studentName, batch });
    if (student && student.parents?.length) {
      // build email
      const emailHtml = `
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Concern Registered</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0; mso-table-rspace:0; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    table { border-collapse:collapse!important; }
    body { margin:0; padding:0; width:100%!important; background:#f4f4f4; font-family:Arial,sans-serif; }
    .container { max-width:600px; margin:20px auto; background:#fff; border-radius:8px; overflow:hidden; 
                 box-shadow:0 4px 12px rgba(0,0,0,0.05); }
    .header { background:#800000; color:#fff; text-align:center; padding:20px; font-size:24px; }
    .content { padding:24px; color:#333; }
    .label { font-size:12px; color:#777; text-transform:uppercase; margin-bottom:4px; }
    .value { font-size:16px; font-weight:500; margin-bottom:16px; }
    .footer { background:#f0f0f0; padding:16px; text-align:center; font-size:12px; color:#666; }
  </style>
</head><body>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table class="container" width="600" cellpadding="0" cellspacing="0">
        <tr><td class="header">Concern Registered</td></tr>
        <tr><td class="content">
          <p>Dear Parent,</p>
          <p>Your ward <strong>${studentName}</strong> (Batch ${batch}) was noted by the guard at ${new Date(istMs).toLocaleString()} with the following concern:</p>
          <div class="label">Description</div>
          <div class="value">${description}</div>
          ${
            documentUrl
              ? `<div class="label">Attachment</div>
                <img src="${imageurl}" alt="evidence" style="max-width:100%;border-radius:4px;margin-bottom:16px;"/>`
              : ""
          }
          <p>Please reach out to the college administration for further details.</p>
        </td></tr>
        <tr><td class="footer">
          Prasad Institute of Medical Sciences, Lucknow – 226401<br/>
          <a href="https://pimslko.edu.in" style="color:#800000;text-decoration:none;">
            www.pimslko.edu.in
          </a> | +91-9721453166
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      // send to each parent
      for (let p of student.parents) {
        await sendEmail({
          to: p.email,
          subject: `Concern registered for ${studentName}`,
          html: emailHtml,
        });
        await fcm.sendFcmToUser(
          p._id,
          "Concern Registered",
          `A concern has been registered for your ward ${studentName}.`,
          {
            studentName: String(studentName),
            batch: String(batch),
            description: String(description),
            concernId: String(concern._id), // <-- convert to string
          },
          "concern-registered",
          String(concern._id)
        );
      }
    }

    clearUploads();

    res.status(201).json({ concern });
  } catch (err) {
    next(err);
  }
};

// controllers/guardController.js

exports.listAllStudents = async (req, res, next) => {
  try {
    const filter = { role: "student" };
    if (req.query.batch) {
      filter.batch = req.query.batch;
    }
    const students = await User.find(filter, "name batch");
    res.status(200).json({ students });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = (req, res) => {
  // req.user comes from your auth middleware
  res.json({ user: req.user });
};