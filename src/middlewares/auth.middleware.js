import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            throw new ApiError(401, "Unauthorized access: No token provided");
        }

        // Verify the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        if (!decodedToken) {
            throw new ApiError(401, "Unauthorized access: Invalid token");
        }

        // Find the user
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");
        
        if (!user) {
            throw new ApiError(401, "Unauthorized access: User not found");
        }

        // Attach user to request object
        req.user = user;
        next();
        
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, "Unauthorized access: Invalid token");
        } else if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, "Unauthorized access: Token expired");
        } else if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError(401, error?.message || "Unauthorized access");
        }
    }
});