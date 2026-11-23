const mongoose = require("mongoose");

const ConcernSchema = new mongoose.Schema({
  guard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentName: { type: String, required: true },
  batch:       { type: String, required: true },
  description: { type: String, required: true },
  documentUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Concern", ConcernSchema);
