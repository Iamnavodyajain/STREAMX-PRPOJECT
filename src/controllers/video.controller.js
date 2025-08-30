import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy || 'createdAt']: sortType === 'desc' ? -1 : 1 }
    }

    const matchStage = { isPublished: true }

    // Add user filter if provided
    if (userId && isValidObjectId(userId)) {
        matchStage.owner = new mongoose.Types.ObjectId(userId)
    }

    // Add search query if provided
    if (query) {
        matchStage.$or = [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
        ]
    }

    const aggregate = Video.aggregate([
        {
            $match: matchStage
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: 1
            }
        }
    ])

    const videos = await Video.aggregatePaginate(aggregate, options)

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    const userId = req.user._id

    console.log("Publish Video - Request received");
    console.log("Title:", title);
    console.log("Description:", description);
    console.log("User ID:", userId);

    // Validation
    if (!title || title.trim() === "") {
        throw new ApiError(400, "Title is required")
    }

    if (!description || description.trim() === "") {
        throw new ApiError(400, "Description is required")
    }

    // Check if files were uploaded
    if (!req.files) {
        console.log("No files found in request");
        throw new ApiError(400, "Both video file and thumbnail are required")
    }

    console.log("Uploaded files:", req.files);

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    console.log("Video file path:", videoFileLocalPath);
    console.log("Thumbnail path:", thumbnailLocalPath);

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required")
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required")
    }

    try {
        // Upload video to Cloudinary
        console.log("Uploading video to Cloudinary...");
        const videoFile = await uploadCloudinary(videoFileLocalPath)
        console.log("Video upload result:", videoFile);

        if (!videoFile) {
            throw new ApiError(500, "Failed to upload video file to Cloudinary")
        }

        // Upload thumbnail to Cloudinary
        console.log("Uploading thumbnail to Cloudinary...");
        const thumbnail = await uploadCloudinary(thumbnailLocalPath)
        console.log("Thumbnail upload result:", thumbnail);

        if (!thumbnail) {
            throw new ApiError(500, "Failed to upload thumbnail to Cloudinary")
        }

        // Create video in database
        const video = await Video.create({
            videoFile: videoFile.url,
            thumbnail: thumbnail.url,
            title: title.trim(),
            description: description.trim(),
            duration: Math.round(videoFile.duration || 0),
            owner: userId,
            isPublished: true
        })

        // Populate owner details
        const createdVideo = await Video.findById(video._id).populate({
            path: "owner",
            select: "username avatar fullName"
        })

        console.log("Video created successfully:", createdVideo._id);

        return res
            .status(201)
            .json(new ApiResponse(201, createdVideo, "Video published successfully"))
            
    } catch (error) {
        console.error("Error in publishAVideo:", error);
        // If it's already an ApiError, rethrow it
        if (error instanceof ApiError) {
            throw error;
        }
        // For any other unexpected errors, throw a 500 error
        throw new ApiError(500, "Internal server error during video publication")
    }
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    // Increment views
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } })

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                isPublished: true
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] }
            }
        }
    ])

    if (!video || video.length === 0) {
        throw new ApiError(404, "Video not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "Video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    //TODO: update video details like title, description, thumbnail
    const userId = req.user._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const updateFields = {}

    if (title !== undefined) {
        if (title.trim() === "") {
            throw new ApiError(400, "Title cannot be empty")
        }
        updateFields.title = title.trim()
    }

    if (description !== undefined) {
        if (description.trim() === "") {
            throw new ApiError(400, "Description cannot be empty")
        }
        updateFields.description = description.trim()
    }

    // Handle thumbnail upload if provided
    if (req.file) {
        const thumbnailLocalPath = req.file.path
        const thumbnail = await uploadCloudinary(thumbnailLocalPath)
        
        if (!thumbnail) {
            throw new ApiError(500, "Failed to upload thumbnail")
        }
        updateFields.thumbnail = thumbnail.url
    }

    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "No valid fields to update")
    }

    const video = await Video.findOneAndUpdate(
        {
            _id: videoId,
            owner: userId
        },
        {
            $set: updateFields
        },
        {
            new: true
        }
    ).populate({
        path: "owner",
        select: "username avatar fullName"
    })

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    const userId = req.user._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findOneAndDelete({
        _id: videoId,
        owner: userId
    })

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findOne({
        _id: videoId,
        owner: userId
    })

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res
        .status(200)
        .json(new ApiResponse(200, video, `Video ${video.isPublished ? 'published' : 'unpublished'} successfully`))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}