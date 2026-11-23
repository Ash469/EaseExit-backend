// models/LeaveApplication.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const LeaveSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true }, // This is the student's initial reason for leave
    documentUrl: { type: String },
    returnDateTime: { type: Date }, // optional, for leave with return
    parentStatus: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      decidedAt: Date,
      // Add an optional reason for parent rejection (though parents might not provide one via this system)
      reason: { type: String },
      // Track whether the decision was made from website link or app
      isDoneFromWebsite: { type: Boolean, default: false },
    },
    wardenStatus: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      decidedAt: Date,
      // Add an optional reason for warden rejection
      reason: { type: String },
    },
    guardStatus: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      decidedAt: Date,
      // Add an optional reason for guard rejection
      reason: { type: String },
    },

    // new field to track admin cancellation
    adminStatus: {
      status: {
        type: String,
        enum: ["pending", "stopped"],
        default: "pending",
      },
      decidedAt: Date,
      // Add an optional reason for admin cancellation
      reason: { type: String },
    },

    parentToken: { type: String, default: () => uuidv4() },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveApplication", LeaveSchema);
