const mongoose = require("mongoose");

const ParentSub = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true },
});

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: {
      type: String,
      enum: ["student", "parent", "warden", "guard", "admin"],
      required: true,
    },
    batch: { type: Number },
    gender: {
      type: String,
     enum: ["Male", "Female"],
       required: function() { return this.role === "student" || this.role === "warden"; }
     },
    parents: [ParentSub],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
