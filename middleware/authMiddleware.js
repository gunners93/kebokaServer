import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  //console.log("RAW AUTH HEADER:", req.headers.authorization);

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Invalid header format" });
  }

  const token = authHeader.split(" ")[1];
  //console.log("TOKEN EXTRACTED:", token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //  console.log("DECODED TOKEN:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
   // console.log("JWT ERROR:", err.message);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
