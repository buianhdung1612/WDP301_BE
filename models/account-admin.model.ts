import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        fullName: String,
        email: String,
        password: String,
        phoneNumber: String,
        roles: [String], // Danh sách ID của Role (Nhóm quyền)
        status: {
            type: String,
            enum: ["initial", "active", "inactive"],
            default: "initial"
        },
        avatar: String,
        search: String,
        lastLoginAt: Date,
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date,
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const AccountAdmin = mongoose.model('AccountAdmin', schema, "accounts-admin");

export default AccountAdmin;
