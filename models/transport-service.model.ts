import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        bookingId: String, // Tham chiếu lịch đặt (nếu là dịch vụ kèm booking)
        petId: String, // ID thú cưng được vận chuyển
        userId: String, // ID khách hàng
        
        serviceType: {
            type: String,
            enum: ["pickup", "delivery", "round-trip"],
            default: "round-trip"
        }, // Loại vận chuyển
        
        pickupAddress: String, // Địa chỉ lấy
        pickupTime: Date, // Thời gian lấy
        
        dropoffAddress: String, // Địa chỉ gửi
        dropoffTime: Date, // Thời gian gửi
        
        distance: Number, // Khoảng cách (km)
        vehicleType: {
            type: String,
            enum: ["bike", "car"],
            default: "bike"
        }, // Loại xe
        
        // Giá cả
        baseFare: {
            bike: 0, // Miễn phí dưới 10km
        },
        costPerKm: {
            bike: 10, // 10k/km
        },
        totalPrice: Number, // Giá tổng cộng       
        
        status: {
            type: String,
            enum: ["pending", "accepted", "in-transit", "completed", "cancelled"],
            default: "pending"
        },
        
        notes: String, // Ghi chú đặc biệt (VD: pet sợ xe, yêu cầu giữ ấm, etc.)
        
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

const TransportService = mongoose.model("TransportService", schema, "transport-services");

export default TransportService;
