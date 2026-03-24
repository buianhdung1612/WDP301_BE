import { Request, Response } from "express";
import BoardingPetDiary from "../../models/boarding-pet-diary.model";
import BoardingBooking from "../../models/boarding-booking.model";
import Pet from "../../models/pet.model";

// GET /api/v1/admin/boarding-pet-diary
// ?bookingId=...&petId=...&date=...
export const index = async (req: Request, res: Response) => {
    try {
        const { bookingId, petId, date } = req.query;
        let query: any = { deleted: false };

        if (bookingId) query.bookingId = bookingId;
        if (petId) query.petId = petId;
        if (date) {
            const startOfDay = new Date(String(date));
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);
            query.date = { $gte: startOfDay, $lt: endOfDay };
        }

        const records = await BoardingPetDiary.find(query).sort({ date: -1, meal: 1 });
        return res.status(200).json({ data: records });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};

// POST /api/v1/admin/boarding-pet-diary
// Upsert based on bookingId, petId, date, meal
export const upsertRecord = async (req: Request, res: Response) => {
    try {
        const adminId = res.locals.accountAdmin?._id || res.locals.user?.id; // Fallback
        const adminName = res.locals.accountAdmin?.fullName || res.locals.user?.fullName || "Staff";

        const {
            bookingId,
            petId,
            date,
            meal,
            eatingStatus,
            digestionStatus,
            moodStatus,
            note,
            proofMedia
        } = req.body;

        if (!bookingId || !petId || !date || !meal) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        let record = await BoardingPetDiary.findOne({
            bookingId,
            petId,
            date: startOfDay,
            meal,
            deleted: false
        });

        if (record) {
            record.eatingStatus = eatingStatus || record.eatingStatus;
            record.digestionStatus = digestionStatus || record.digestionStatus;
            record.moodStatus = moodStatus || record.moodStatus;
            record.note = typeof note === "string" ? note : record.note;
            record.proofMedia = proofMedia || record.proofMedia;
            record.staffId = adminId;
            record.staffName = adminName;
            await record.save();
        } else {
            record = await BoardingPetDiary.create({
                bookingId,
                petId,
                date: startOfDay,
                meal,
                eatingStatus,
                digestionStatus,
                moodStatus,
                note,
                proofMedia,
                staffId: adminId,
                staffName: adminName,
            });
        }

        return res.status(200).json({ data: record, message: "Cập nhật nhật ký thành công" });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
};
