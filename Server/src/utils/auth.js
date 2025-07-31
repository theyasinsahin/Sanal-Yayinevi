import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const authenticateUser = async (req, User) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Not authenticated");
  }

  const token = authHeader.replace("Bearer ", "");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "SECRET_KEY");
  } catch (err) {
    throw new Error("Invalid or expired token");
  }

  if (!decoded?.userId) {
    throw new Error("Invalid token payload");
  }

  const user = await User.findById(decoded.userId).select("-password");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};
