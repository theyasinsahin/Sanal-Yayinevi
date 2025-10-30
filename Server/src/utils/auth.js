import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

export const authenticateUser = async (req, User) => {
  const token = req.headers.authorization;
  
  if (!token) {
    throw new Error("Not authenticated");
  }
  
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
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
