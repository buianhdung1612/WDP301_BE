import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String, // Tên nhân viên
        email: String,
        phone: String,
        avatar: String,
        
        // Chuyên môn
        services: [String], // Danh sách ID dịch vụ có thể thực hiện
        specialties: [String], // Chuyên môn (grooming, vaccination, etc.)
        experience: Number, // Số năm kinh nghiệm
        
        // Lịch làm việc
        workingDays: [String], // ["monday", "tuesday", ...] hoặc cỡ lịch riêng
        workingHours: {
            startTime: String, // "08:00"
            endTime: String // "18:00"
        },
        
        // Thông tin thanh toán
        bankAccount: String,
        bankName: String,
        
        // Thống kê
        rating: {
            type: Number,
            default: 5
        },
        totalBookings: {
            type: Number,
            default: 0
        },
        
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        search: String,
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    {
        timestamps: true,
    }
);

const Staff = mongoose.model("Staff", schema, "staff");

export default Staff;
