import { Request, Response } from "express";
import BoardingPetDiary from "../../models/boarding-pet-diary.model";
import BoardingBooking from "../../models/boarding-booking.model";

// GET /api/v1/client/boarding-pet-diary?bookingId=...
export const index = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user?.id || res.locals.accountUser?._id;
        if (!userId) {
            return res.status(401).json({ message: "Vui lòng đăng nhập" });
        }

        const { bookingId } = req.query;
        if (!bookingId) {
            return res.status(400).json({ message: "Thiếu mã đặt phòng (bookingId)" });
        }

        // Verify that the user owns this booking
        const booking = await BoardingBooking.findOne({ _id: bookingId, userId, deleted: false });
        if (!booking) {
            return res.status(404).json({ message: "Không tìm thấy hóa đơn gửi thú cưng" });
        }

        const diaries = await BoardingPetDiary.find({ bookingId, deleted: false })
            .populate('petId', 'name breed type avatar')
            .sort({ date: -1, meal: 1 });

        return res.status(200).json({ data: diaries });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};
