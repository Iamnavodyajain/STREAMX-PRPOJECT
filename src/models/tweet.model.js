import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2"; // Import the plugin

const tweetSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true});

// Add the plugin to your schema
tweetSchema.plugin(aggregatePaginate);

export const Tweet = mongoose.model("Tweet", tweetSchema);