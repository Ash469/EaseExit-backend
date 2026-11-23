const jwt  = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    // Decode the token to get the user ID and role
    const { id, role, email } = jwt.verify(token, process.env.JWT_SECRET);


    let user;
    if (role === 'parent') {
      // Find the student whose parents array contains this parent _id
      const student = await User.findOne({
        role: 'student',
        'parents._id': id,
        'parents.email': email
      });
      if (!student) {
        return res.status(401).json({ message: 'Parent not found' });
      }
      // Find the parent object
      const parentObj = student.parents.find(
        (p) => p._id?.toString() === id && p.email === email
      );
      // console.log('Parent object found:', parentObj);

      if (!parentObj) {
        return res.status(401).json({ message: 'Parent not found' });
      }
      // Attach parent info and also studentId for reference
      user = {
        ...parentObj.toObject?.() || parentObj,
        role: 'parent',
        studentId: student._id
      };
    } else {
      // Normal user (student, admin, etc)
      user = await User.findById(id).select('-password');
      // console.log('User found:', user ? user._id : null);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
    }

    const istTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log("Decoded JWT User:", user?.email , istTime );

    req.user = user;
    next();
  } catch (err) {
    console.log('JWT error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function isGuard(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (req.user.role !== 'guard') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

async function isParent(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (req.user.role !== 'parent') {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Use studentId from req.user (set in protect)
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(404).json({ message: 'Student not found' });
  }
  const student = await User.findById(studentId);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ message: 'Student not found' });
  }

  // Check if parent's _id (from JWT) is in the student's parents array
  const parentId = req.user._id?.toString() || req.user.id?.toString();
  const isLinked = student.parents.some(
    (p) => p._id?.toString() === parentId
  );
  if (!isLinked) {
    return res.status(403).json({ message: 'Access denied to this student' });
  }

  next();
}

async function isWarden(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (req.user.role !== 'warden') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

async function isAdmin(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

module.exports = {
  isAdmin,
  protect,
  isGuard,
  isParent,
  isWarden
};