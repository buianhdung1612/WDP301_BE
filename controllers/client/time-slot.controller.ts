import { Request, Response } from "express";
import TimeSlot from "../../models/time-slot.model";
import moment from "moment";

// Standard operating hours
const STANDARD_SLOTS = [
    "08:00", "09:00", "10:00", "11:00",
    "13:00", "14:00", "15:00", "16:00"
];

// [GET] /api/v1/client/time-slots
export const listTimeSlots = async (req: Request, res: Response) => {
    try {
        const { date, serviceId } = req.query;

        if (!date || !serviceId) {
            return res.status(400).json({
                code: 400,
                message: "Vui lòng cung cấp date và serviceId"
            });
        }

        const inputDate = moment(date as string, "YYYY-MM-DD");
        if (!inputDate.isValid()) {
            return res.status(400).json({
                code: 400,
                message: "Ngày không hợp lệ"
            });
        }

        // Find existing slots in DB for this date and service
        const existingSlots = await TimeSlot.find({
            serviceId: serviceId,
            date: {
                $gte: inputDate.startOf('day').toDate(),
                $lte: inputDate.endOf('day').toDate()
            }
        });

        // Merge standard slots with DB status
        const result = STANDARD_SLOTS.map(time => {
            const found = existingSlots.find(s => s.startTime === time);

            if (found) {
                // If exists in DB, use its status
                return {
                    time,
                    status: found.status, // available, full, unavailable
                    slotId: found._id
                };
            } else {
                // If not in DB, it's available (virtual slot)
                return {
                    time,
                    status: "available",
                    slotId: null // Frontend sends string anyway now
                };
            }
        });

        res.json({
            code: 200,
            message: "Danh sách khung giờ",
            data: result
        });

    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách khung giờ",
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
