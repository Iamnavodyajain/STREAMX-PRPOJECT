//require("dotenv").config({path: "../.env"});
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";   // ✅ use the configured app from app.js

// Load environment variables
dotenv.config({ path: "../.env" });

// Connect to DB and start server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection failed:", error);
  });



/* Approach to connect db but it makex our index file heavy

import express from "express";
const app = express();

(async ()=> {
    try {
     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
     app.on("error", (err) => {
         console.error("Server error:", err);
         throw err;
    })
    app.listen(process.env.PORT , ()=>{
        console.log(`Server is running on port ${process.env.PORT}`);
     })
    }catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
})()

*/