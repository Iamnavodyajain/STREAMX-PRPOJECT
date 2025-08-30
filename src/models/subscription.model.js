import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const subscriptionSchema = new mongoose.Schema({
    subscriber: {
        type: mongoose.Schema.Types.ObjectId, // The one who is subscribing
        ref: "User"
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId, // The one whom subscriber is subscribing
        ref: "User" 
    }
}, { timestamps: true });

// Add the plugin to your schema
subscriptionSchema.plugin(aggregatePaginate);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);