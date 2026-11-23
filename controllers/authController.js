// controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

/**
 * Admin creates any user.
 * If role==='student', enforces @pims.edu.in and accepts parents array.
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, parents , gender } = req.body;

    // Students must use the official domain
    if (role === "student" && !email.endsWith("@pims.edu.in")) {
      return res
        .status(400)
        .json({ message: "Students must register with @pims.edu.in email" });
    }

    // Build user object
    const userData = { name, email, password, role };
    if (role === "student") {
      userData.parents = Array.isArray(parents) ? parents : [];
    }

    const user = await User.create(userData);
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * All roles log in here.
 * Students: domain check
 * Parents & others: simple email+password
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and pull in hashed password
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Student domain enforcement on login
    if (user.role === "student" && !email.endsWith("@pims.edu.in")) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// remove register(), login(), logout(), getMe() entirely

// controllers/authController.js
// const jwt = require('jsonwebtoken');

exports.callbackHandler = (req, res) => {
  // 1) issue JWT
  const token = jwt.sign(
    { id: req.user._id, role: req.user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // 2) build the redirect back into React
  const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${token}&userRole=${req.user.role}`;

  // 3) set cookie & redirect
  res
    .cookie("token", token, {
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      secure: process.env.NODE_ENV === "production",
    })
    .redirect(redirectUrl);
};

// Add this controller to verify Google user by email and role
exports.verifyGoogleUser = async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ message: "Email and role are required." });
  }
  try {
    let user;
    if (role === "parent") {
      // Find a student whose parents array contains this email
      const student = await User.findOne({
        role: "student",
        "parents.email": email,
      });
      if (!student) {
        return res
          .status(401)
          .json({ message: "Parent not found or not linked to any student." });
      }
      // Find the parent object inside the student's parents array
      const parentObj = student.parents.find((p) => p.email === email);
      if (!parentObj) {
        return res
          .status(401)
          .json({ message: "Parent not found in student record." });
      }
      user = {
        _id: parentObj._id,
        name: parentObj.name,
        email: parentObj.email,
        role: "parent",
        studentId: student._id, // Optionally include linked student
      };
    } else {
      // For other roles, match email and role directly
      user = await User.findOne({ email, role });
      if (!user) {
        return res
          .status(401)
          .json({ message: "User not found or role mismatch." });
      }
    }

    // Issue JWT
    const token = jwt.sign(
      {
        id: user._id || undefined,
        role: user.role,
        email: user.email || email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      id: user._id || undefined,
      role: user.role,
      email: user.email || email,
      gender: user.gender || undefined,
      name: user.name,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error." });
  }
};
