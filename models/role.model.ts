import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String,
        description: String,
        isStaff: {
            type: Boolean,
            default: false
        }, // Đánh dấu đây là nhóm quyền dành cho nhân viên thực hiện dịch vụ
        serviceIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service"
        }], // Nếu isStaff=true: Danh sách dịch vụ mà nhân viên này có thể thực hiện
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department"
        }, // Role thuộc phòng ban nào
        level: {
            type: String,
            enum: ["manager", "staff", "intern"],
            default: "staff"
        }, // Cấp bậc
        canManageSchedule: {
            type: Boolean,
            default: false
        }, // Được phân ca không?
        commissionRate: {
            type: Number,
            default: 0
        }, // % hoa hồng mặc định theo level/role
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
