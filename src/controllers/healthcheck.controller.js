import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const healthcheck = asyncHandler(async (req, res) => {
    //TODO: build a healthcheck response that simply returns the OK status as json with a message
    
    // Create a health check response object with basic server status
    const healthCheck = {
        status: "OK",
        message: "Server is running smoothly",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    }

    // Return the health check response as JSON
    return res
        .status(200)
        .json(new ApiResponse(200, healthCheck, "Health check successful"))
})

export {
    healthcheck
}