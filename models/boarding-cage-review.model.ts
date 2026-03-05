import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        cageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BoardingCage",
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser",
            required: true
        },
        fullName: {
            type: String,
            required: true
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true
        },
        comment: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["approved", "hidden"],
            default: "approved"
        },
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    {
        timestamps: true
    }
);

schema.index({ cageId: 1, createdAt: -1 });
schema.index({ cageId: 1, userId: 1, createdAt: -1 });

const BoardingCageReview = mongoose.model("BoardingCageReview", schema, "boarding-cage-reviews");

export default BoardingCageReview;

