import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { aggregatePaginate } from "mongoose-aggregate-paginate-v2"; // Added missing import

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    const userId = req.user._id

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Playlist name is required")
    }

    if (!description || description.trim() === "") {
        throw new ApiError(400, "Playlist description is required")
    }

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        owner: userId,
        videos: []
    })

    const createdPlaylist = await Playlist.findById(playlist._id)

    return res
        .status(201)
        .json(new ApiResponse(201, createdPlaylist, "Playlist created successfully"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID")
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
    }

    const playlists = await Playlist.aggregatePaginate(
        Playlist.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    pipeline: [
                        {
                            $project: {
                                title: 1,
                                thumbnail: 1,
                                duration: 1,
                                views: 1
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    videosCount: { $size: "$videos" }
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    videos: 1,
                    videosCount: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]),
        options
    )

    return res
        .status(200)
        .json(new ApiResponse(200, playlists, "User playlists fetched successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
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
                            owner: { $arrayElemAt: ["$owner", 0] }
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            thumbnail: 1,
                            duration: 1,
                            views: 1,
                            createdAt: 1,
                            owner: 1
                        }
                    }
                ]
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
                owner: { $arrayElemAt: ["$owner", 0] },
                videosCount: { $size: "$videos" }
            }
        }
    ])

    if (!playlist || playlist.length === 0) {
        throw new ApiError(404, "Playlist not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    const userId = req.user._id

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID")
    }

    const playlist = await Playlist.findOne({
        _id: playlistId,
        owner: userId
    })

    if (!playlist) {
        throw new ApiError(404, "Playlist not found or you don't have permission")
    }

    // Check if video already exists in playlist
    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already exists in playlist")
    }

    playlist.videos.push(videoId)
    await playlist.save()

    const updatedPlaylist = await Playlist.findById(playlistId).populate({
        path: "videos",
        select: "title thumbnail duration views"
    })

    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    const userId = req.user._id

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID")
    }

    const playlist = await Playlist.findOne({
        _id: playlistId,
        owner: userId
    })

    if (!playlist) {
        throw new ApiError(404, "Playlist not found or you don't have permission")
    }

    // Check if video exists in playlist
    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video not found in playlist")
    }

    playlist.videos = playlist.videos.filter(vid => vid.toString() !== videoId)
    await playlist.save()

    const updatedPlaylist = await Playlist.findById(playlistId).populate({
        path: "videos",
        select: "title thumbnail duration views"
    })

    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const userId = req.user._id

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.findOneAndDelete({
        _id: playlistId,
        owner: userId
    })

    if (!playlist) {
        throw new ApiError(404, "Playlist not found or you don't have permission")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Playlist deleted successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    const userId = req.user._id

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Playlist name is required")
    }

    if (!description || description.trim() === "") {
        throw new ApiError(400, "Playlist description is required")
    }

    const playlist = await Playlist.findOneAndUpdate(
        {
            _id: playlistId,
            owner: userId
        },
        {
            $set: {
                name: name.trim(),
                description: description.trim()
            }
        },
        { new: true }
    ).populate({
        path: "videos",
        select: "title thumbnail duration views"
    })

    if (!playlist) {
        throw new ApiError(404, "Playlist not found or you don't have permission")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist updated successfully"))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}