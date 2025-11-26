import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  
  return jwt.sign(
    {
      id: user.Id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      state: user.state,
      lga: user.lga,
      city: user.city,
      isStudent: user.isStudent,
      occupation: user.occupation,
      schoolName: user.schoolName,
      department: user.department,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
