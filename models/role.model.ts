import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String,
        description: String,
        isStaff: {
            type: Boolean,
            default: false
        }, // Đánh dấu đây là nhóm quyền dành cho nhân viên thực hiện dịch vụ
        skillSet: [String], // Các kỹ năng/dịch vụ thuộc nhóm này (VD: ["Cắt tỉa", "Vệ sinh tai"])
        permissions: [String],
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "inactive"
        },
        search: String,
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const Role = mongoose.model('Role', schema, "roles");

export default Role;
