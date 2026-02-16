import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        fullName: String,
        email: String,
        password: String,
        phone: String,
        roles: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role"
        }], // Danh sách ID của Role (Nhóm quyền)
        employeeCode: {
            type: String,
            unique: true,
            sparse: true
        }, // Mã nhân viên (auto-gen)
        dateOfBirth: Date,
        hireDate: Date, // Ngày vào làm
        contractType: {
            type: String,
            enum: ["full-time", "part-time", "contract"],
            default: "full-time"
        },
        baseSalary: {
            type: Number,
            default: 0
        },
        bankAccount: String,
        emergencyContact: {
            name: String,
            phone: String,
            relationship: String
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
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
