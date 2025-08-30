import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(500, "Token generation failed");
  }
};

const registeruser = asyncHandler(async (req, res) => {
  const { email, userName, fullName, password } = req.body;

  // Validate fields
  if ([email, userName, fullName, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ email }, { userName }],
  });

  if (existedUser) {
    throw new ApiError(400, "User already exists with this email or username");
  }

  // Get file paths
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }

  // Upload to Cloudinary
  const avatar = await uploadCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadCloudinary(coverImageLocalPath)
    : null;

  // Enhanced Cloudinary error handling
  if (!avatar || typeof avatar !== 'object' || !avatar.url) {
    console.error("Avatar upload failed. Response:", avatar);
    throw new ApiError(500, "Avatar upload failed. Please try again.");
  }

  if (coverImageLocalPath && (!coverImage || typeof coverImage !== 'object' || !coverImage.url)) {
    console.error("Cover image upload failed. Response:", coverImage);
    throw new ApiError(500, "Cover image upload failed. Please try again.");
  }

  // Create user
  const user = await User.create({
    email,
    userName: userName.toLowerCase(),
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // Fetch created user without sensitive fields
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User creation failed");
  }

  // Send response
  return res.status(201).json(
    new ApiResponse(201, createdUser, "User created successfully")
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, userName, password } = req.body;
  if (!(userName || email)) {
    throw new ApiError(400, "Email or Username is required");
  }

  const user = await User.findOne({
    $or: [{ userName }, { email }]
  });

  if (!user) {
    throw new ApiError(400, "Invalid credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true
  };

  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "Login successful"));
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined }
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true
  };

  return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access - No token");
  }
  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Unauthorized access - No user");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token mismatch");
    }

    const options = {
      httpOnly: true,
      secure: true
    };

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

    return res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Token refreshed successfully"));

  } catch (error) {
    throw new ApiError(401, "Unauthorized access - Invalid token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldpassword, newpassword } = req.body;
  
  if (!oldpassword || !newpassword) {
    throw new ApiError(400, "Both old and new passwords are required");
  }
  
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);
  
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old password is incorrect");
  }

  user.password = newpassword;
  await user.save({ validateBeforeSave: false });
  
  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // Convert Mongoose document to plain object to avoid circular references
  const userObject = req.user.toObject();
  return res.status(200).json(new ApiResponse(200, userObject, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  
  if (!fullName && !email) {
    throw new ApiError(400, "At least one field is required to update");
  }
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { fullName, email }
    },
    {
      new: true,
    }
  ).select("-password").lean();

  return res.status(200).json(
    new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }
  
  const avatar = await uploadCloudinary(avatarLocalPath);
  
  // Enhanced Cloudinary error handling
  if (!avatar || typeof avatar !== 'object' || !avatar.url) {
    console.error("Avatar upload failed. Response:", avatar);
    throw new ApiError(500, "Avatar upload failed. Please try again.");
  }
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: avatar.url }
    },
    {
      new: true,
    }
  ).select("-password").lean();
  
  return res.status(200).json(
    new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is required");
  }
  
  const coverImage = await uploadCloudinary(coverImageLocalPath);
  
  // Enhanced Cloudinary error handling
  if (!coverImage || typeof coverImage !== 'object' || !coverImage.url) {
    console.error("Cover image upload failed. Response:", coverImage);
    throw new ApiError(500, "Cover image upload failed. Please try again.");
  }
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: coverImage.url }
    },
    {
      new: true,
    }
  ).select("-password").lean();
  
  return res.status(200).json(
    new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params; // Change userName to username
  
  console.log("Request params:", req.params);
  console.log("Username received:", username);
  
  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  const channel = await User.aggregate([
    {
      $match: { 
        userName: username.toLowerCase().trim() // Use the variable correctly
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: { 
          $size: "$subscribers" 
        },
        subscribedToCount: { 
          $size: "$subscribedTo" 
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [
                req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null, 
                "$subscribers.subscriber"
              ]
            },
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      }
    }
  ]);

  console.log("Aggregation result:", channel);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }

  return res.status(200).json(
    new ApiResponse(200, channel[0], "Channel profile fetched successfully")
  );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ]);

  // Convert to plain object to avoid circular references
  const plainUser = JSON.parse(JSON.stringify(user));
  
  return res.status(200).json(
    new ApiResponse(200, plainUser[0]?.watchHistory || [], "Watch history fetched successfully")
  );
});

export {
  registeruser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory
};