import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        code: {
            type: String,
            unique: true,
            sparse: true
        },
        description: String,
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date,
    },
    {
        timestamps: true,
    }
);

const Department = mongoose.model("Department", schema, "departments");

export default Department;
