import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        checkInEarlyLimit: {
            type: Number,
            default: 15
        }, // Số phút được phép check-in sớm
        checkOutLateLimit: {
            type: Number,
            default: 60
        }, // Số phút được phép check-out muộn
        lateThreshold: {
            type: Number,
            default: 10
        }, // Sau bao nhiêu phút thì coi là đi muộn
        absentThreshold: {
            type: Number,
            default: 60
        }, // Sau bao nhiêu phút không check-in thì coi là vắng mặt
        workDayStartTime: {
            type: String,
            default: "08:00"
        }, // Giờ sớm nhất hệ thống mở cửa/cho phép check-in
        workDayEndTime: {
            type: String,
            default: "22:00"
        }, // Giờ muộn nhất hệ thống đóng cửa
    },
    {
        timestamps: true,
    }
);

const AttendanceConfig = mongoose.model('AttendanceConfig', schema, "attendance-configs");

export default AttendanceConfig;
