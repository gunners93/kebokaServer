import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
 import { generateToken } from "../utils/generateToken.js";
export const registerUser = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword)
    return res.status(400).json({ message: "All fields are required" });

  if (password !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match" });

  try {
    // Check if user already exists
    const [existingUser] = await db
      
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db
      
      .query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword]
      );

    // Optionally return created user info without token
    const user = { id: result.insertId, name, email };
 await sendWelcomeEmail(email, name);
    res.status(201).json({
      success: true,
      message: "Registration successful. Please log in.",
      user,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
// export const loginUser = async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password)
//     return res.status(400).json({ message: "Email and password required" });

//   try {
//     const [user] = await db
//       
//       .query("SELECT * FROM users WHERE email = ?", [email]);

//     if (user.length === 0)
//       return res.status(404).json({ message: "User not found" });

//     const isMatch = await bcrypt.compare(password, user[0].password);

//     if (!isMatch)
//       return res.status(401).json({ message: "Invalid credentials" });

//     const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, {
//       expiresIn: "7d",
//     });

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       user: {
//         id: user[0].id,
//         name: user[0].name,
//         email: user[0].email,
//       },
//       token,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const [rows] = await db
      
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // const token = jwt.sign({ id: user.Id,
    //   name: user.name,
    //   email: user.email, }, process.env.JWT_SECRET, {
    //   expiresIn: "7d",
    // });

  //   console.log("Generated user.id,:", user.Id,);

  //   console.log("Generated Token:", user);
  //  return;
     const token = generateToken(user);

    const { password: _, ...safeUser } = user; // remove password

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: safeUser,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMe = async (req, res) => {
  try {
    // user is already attached to req by protect middleware
    res.json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const userProfileUpdate = async (req, res) => {
   const userId = req.user.id;
 
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }


  const {
    name,
    email,
    phone,
    state,
    lga,
    city,
    isStudent,
    occupation,
    schoolName,
    department,
  } = req.body;

  try {
    // Update user
    await db.query(
      `UPDATE users SET phone = ?, state = ?, lga = ?, city = ?, isStudent = ?, occupation = ?, schoolName = ?, department = ? WHERE id = ?`,
      [
        phone,
        state,
        lga,
        city,
        isStudent,
        occupation,
        schoolName,
        department,
        userId,
      ]
    );

    // Get updated user
    // const [rows] = await db.query(
    //   `SELECT id, name, email, phone, state, lga, city, isStudent, occupation, schoolName, department 
    //    FROM users WHERE id = ?`,
    //   [userId]
    // );

      const query = "SELECT * FROM users WHERE id = ?";
    const [rows] = await db.query(query, [userId]);
    //show query result in console
   // console.log(query);

    const updatedUser = rows[0];
    // console.log("Updated user data:", updatedUser);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const uploadKyc = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { idType, idNumber } = req.body;
    const files = req.files;

    if (!files.frontImage || !files.backImage || !files.proofOfAddress) {
      return res.status(400).json({ message: 'All documents are required.' });
    }

    // Prepare file paths for DB
    const frontPath = files.frontImage[0].path;
    const backPath = files.backImage[0].path;
    const addressPath = files.proofOfAddress[0].path;

    const sql = `
      UPDATE users 
      SET 
        kyc_status = 'pending',
        kyc_id_type = ?,
        kyc_id_number = ?,
        kyc_front_image = ?,
        kyc_back_image = ?,
        kyc_proof_address = ?,
        kyc_submitted_at = NOW()
      WHERE id = ?
    `;

    // Execute query (assuming 'db' is your mysql connection pool)
    console.log(sql);
 await db.query(sql, [idType, idNumber, frontPath, backPath, addressPath, userId]);

    res.status(200).json({ 
      message: 'KYC submitted successfully!',
      status: 'pending' 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Database update failed.' });
  }
};
