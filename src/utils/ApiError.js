class ApiError extends Error {
    constructor(
        message = "Something Went Wrong",
        statusCode,
        errors = [],
        stack = ""
    ){
        super(message)
        this.statuscode = statusCode
        this.errors = errors
        this.data = null
        this.message = message
        this.success = false

        if(stack){
            this.stack = stack
        } else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export { ApiError }