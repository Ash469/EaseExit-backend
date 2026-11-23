// controllers/adminUserController.js
const User = require("../models/User");

/**
 * List all users (no passwords)
 */
exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password"); // schema no longer has password
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single user by ID
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new user (no password)
 * Body: { name, email, role, batch?, parents? }
 * parents is an array of { name, email }
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, role, batch, parents, gender } = req.body;

    // Basic validation
    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, and role are required" });
    }
    if (role === "student" && !gender) {
      return res
        .status(400)
        .json({ message: "Gender is required for students" });
    }
    if (role === "warden" && !gender) {
      return res
        .status(400)
        .json({ message: "Gender is required for wardens" });
    }
    // Build the user data
    const userData = {
      name,
      email,
      role,
      ...((role === "student" || role === "warden") && { gender }),
    };
    if (batch != null) {
      userData.batch = batch;
    }
    if (role === "student" && Array.isArray(parents)) {
      userData.parents = parents.map((p) => ({
        name: p.name,
        email: p.email,
      }));
    }
    

    // console.log("Creating user with data:", userData);

    const user = await User.create(userData);

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        batch: user.batch,
        gender: user.gender,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing user (no password)
 * Body may include any of: { name, email, role, batch, parents }
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, batch, parents , gender } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (typeof gender !== "undefined") updates.gender = gender;
    if (batch != null) updates.batch = batch;
    if (Array.isArray(parents)) {
      updates.parents = parents.map((p) => ({
        name: p.name,
        email: p.email,
      }));
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a user
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Remove safeJsonParse as it's no longer needed for JSON string parsing from Excel.
// const safeJsonParse = (str) => {
//     try {
//         return JSON.parse(str);
//     } catch (err) {
//         try {
//             // Attempt to fix common formatting issues
//             const fixedStr = str
//                 .replace(/'/g, '"')   // Replace single quotes with double quotes
//                 .replace(/(\w+):/g, '"$1":');   // Add quotes around keys
//             return JSON.parse(fixedStr);
//         } catch (fixErr) {
//             console.error('JSON parse error:', str, fixErr);
//             return [];
//         }
//     }
// };

exports.bulkUploadStudents = async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No student data provided" });
    }

    const createdStudents = [];
    const errors = [];

    // Iterate over each row from the Excel sheet
    for (const [index, row] of rows.entries()) {
      try {
        // Basic validation for mandatory student fields
        if (!row.name || !row.email || !row.batch || !row.gender) {
          // Skip rows that are entirely empty or missing critical data
          if (
            !row.name &&
            !row.email &&
            !row.batch &&
            !row.gender &&
            !row.parentName &&
            !row.parentEmail
          ) {
            continue; // Skip entirely empty rows
          }
          throw new Error("Missing student name, email, or batch");
        }

        const studentData = {
          name: row.name,
          email: row.email,
          role: "student", // Assuming a default role for bulk uploaded students
          batch: row.batch,
          gender: row.gender,
        };

        // --- NEW LOGIC: Process parent from individual columns ---
        const parents = [];
        // Check if both parentName and parentEmail are provided for a single parent
        if (row.parentName && row.parentEmail) {
          parents.push({
            name: row.parentName,
            email: row.parentEmail,
          });
        }
        // Assign the 'parents' array to studentData if a parent was found
        if (parents.length > 0) {
          studentData.parents = parents;
        }
        // --- END NEW LOGIC ---

        // Create the student in the database
        // Assuming 'User' is your Mongoose model or similar ORM
        const student = await User.create(studentData);
        createdStudents.push({
          id: student._id,
          name: student.name,
          email: student.email,
          gender: student.gender,
        });
      } catch (err) {
        // Log and collect errors for rows that failed
        errors.push({
          row: index + 1, // Excel rows are 1-indexed
          error: err.message,
          rowData: row, // Include the row data for context
        });
        console.error(`Error processing row ${index + 1}:`, err.message, row);
      }
    }

    // Send back a comprehensive response indicating success, partial success, or failure
    res.status(errors.length ? 207 : 201).json({
      message: errors.length
        ? "Partial success: Some students could not be created."
        : "All students created successfully!",
      createdCount: createdStudents.length,
      errorCount: errors.length,
      createdStudents,
      errors,
    });
  } catch (err) {
    // Catch any errors that occur before or during the row iteration
    console.error("Bulk upload handler error:", err);
    next(err); // Pass the error to the next error-handling middleware
  }
};

exports.bulkDeleteUsers = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No user IDs provided" });
    }

    const result = await User.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} users deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
};
