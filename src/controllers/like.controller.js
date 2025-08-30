import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    const userId = req.user._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    // Check if user already liked the video
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    })

    let message, like

    if (existingLike) {
        // Unlike the video
        await Like.findByIdAndDelete(existingLike._id)
        message = "Video unliked successfully"
    } else {
        // Like the video
        like = await Like.create({
            video: videoId,
            likedBy: userId
        })
        message = "Video liked successfully"
    }

    return res
        .status(200)
        .json(new ApiResponse(200, like || null, message))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    const userId = req.user._id

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    // Check if user already liked the comment
    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId
    })

    let message, like

    if (existingLike) {
        // Unlike the comment
        await Like.findByIdAndDelete(existingLike._id)
        message = "Comment unliked successfully"
    } else {
        // Like the comment
        like = await Like.create({
            comment: commentId,
            likedBy: userId
        })
        message = "Comment liked successfully"
    }

    return res
        .status(200)
        .json(new ApiResponse(200, like || null, message))
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    const userId = req.user._id

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    // Check if user already liked the tweet
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    })

    let message, like

    if (existingLike) {
        // Unlike the tweet
        await Like.findByIdAndDelete(existingLike._id)
        message = "Tweet unliked successfully"
    } else {
        // Like the tweet
        like = await Like.create({
            tweet: tweetId,
            likedBy: userId
        })
        message = "Tweet liked successfully"
    }

    return res
        .status(200)
        .json(new ApiResponse(200, like || null, message))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const userId = req.user._id
    const { page = 1, limit = 10 } = req.query

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
    }

    const aggregate = Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $exists: true, $ne: null }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
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
                            owner: {
                                $arrayElemAt: ["$owner", 0]
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$video"
        },
        {
            $project: {
                _id: 0,
                video: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    thumbnail: 1,
                    duration: 1,
                    views: 1,
                    isPublished: 1,
                    createdAt: 1,
                    owner: 1
                },
                likedAt: "$createdAt"
            }
        }
    ])

    const likedVideos = await Like.aggregatePaginate(aggregate, options)

    return res
        .status(200)
        .json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}