import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ["overrun", "booking", "order", "review", "boarding", "system", "delayed"],
            default: "system"
        },
        link: String,
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountUser"
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        status: {
            type: String,
            enum: ['unread', 'read', 'archived'],
            default: 'unread'
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
);

const Notification = mongoose.model("Notification", schema, "notifications");

export default Notification;
