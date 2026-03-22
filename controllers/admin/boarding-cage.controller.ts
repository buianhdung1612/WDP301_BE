import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingCage from "../../models/boarding-cage.model";
import BoardingBooking from "../../models/boarding-booking.model";

const pickParam = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        const first = value[0];
        return typeof first === "string" ? first : undefined;
    }
    return undefined;
};

const legacySizeMap: Record<string, string> = {
    C: "S",
    B: "M",
    A: "L",
    XL: "XL_XXL",
    XXL: "XL_XXL",
};

const sizeQueryMap: Record<string, string[]> = {
    S: ["S", "C"],
    M: ["M", "B"],
    L: ["L", "A"],
    XL_XXL: ["XL_XXL", "XL", "XXL"],
};

const normalizeCageSize = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const raw = value.trim().toUpperCase();
    if (!raw) return undefined;
    return legacySizeMap[raw] || raw;
};

const buildSizeFilter = (value: unknown) => {
    const normalized = normalizeCageSize(value);
    if (!normalized) return undefined;
    const matched = sizeQueryMap[normalized] || [normalized];
    return { $in: matched };
};

const normalizeAmenities = (value: unknown): string[] => {
    const rawList = Array.isArray(value)
        ? value.map((item) => String(item || ""))
        : typeof value === "string"
            ? value.split(/[\n,;]+/)
            : [];

    const normalized = rawList
        .map((item) => item.trim())
        .filter(Boolean);

    return Array.from(new Set(normalized));
};

const extractHttpUrls = (text: string): string[] => {
    const matches = String(text || "").match(/https?:\/\/\S+/gi) || [];
    return matches
        .map((item) => item.trim().replace(/[),;]+$/g, ""))
        .filter((item) => /^https?:\/\//i.test(item));
};

const normalizeImageList = (value: unknown): string[] => {
    const rawList = Array.isArray(value)
        ? value.flatMap((item) => extractHttpUrls(String(item || "")))
        : typeof value === "string"
            ? extractHttpUrls(value)
            : [];
    return Array.from(new Set(rawList));
};

// [GET] /api/v1/admin/boarding-cage
export const listBoardingCages = async (req: Request, res: Response) => {
    try {
        const { search, type, size, status, is_trash } = req.query as Record<string, string>;
        const filter: any = { deleted: is_trash === "true" ? true : false };

        if (type) filter.type = type;
        if (size) {
            const sizeFilter = buildSizeFilter(size);
            if (sizeFilter) filter.size = sizeFilter;
        }
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { cageCode: new RegExp(search, "i") },
                { description: new RegExp(search, "i") },
            ];
        }

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [recordList, totalRecords, deletedCount] = await Promise.all([
            BoardingCage.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            BoardingCage.countDocuments(filter),
            BoardingCage.countDocuments({ deleted: true })
        ]);

        return res.json({
            code: 200,
            data: {
                recordList,
                pagination: {
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    currentPage: page,
                    limit,
                    deletedCount
                }
            }
        });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [POST] /api/v1/admin/boarding-cage/create
export const createBoardingCage = async (req: Request, res: Response) => {
    try {
        const { cageCode, type, size, maxWeightCapacity, dailyPrice, avatar, gallery, description, amenities, status } = req.body;
        const normalizedSize = normalizeCageSize(size);
        if (!cageCode || !normalizedSize) {
            return res.status(400).json({ code: 400, message: "Thiếu mã chuồng hoặc kích thước" });
        }

        const existed = await BoardingCage.findOne({ cageCode, deleted: false });
        if (existed) {
            return res.status(400).json({ code: 400, message: "Mã chuồng đã tồn tại" });
        }

        const created = await BoardingCage.create({
            cageCode,
            type,
            size: normalizedSize,
            maxWeightCapacity,
            dailyPrice,
            avatar,
            gallery: normalizeImageList(gallery),
            description,
            amenities: normalizeAmenities(amenities),
            status
        });

        return res.json({ code: 200, message: "Tạo chuồng thành công", data: created });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [PATCH] /api/v1/admin/boarding-cage/:id
export const updateBoardingCage = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID không hợp lệ" });
        }

        const { cageCode, ...payload } = req.body;
        if (cageCode) {
            const existed = await BoardingCage.findOne({ _id: { $ne: id }, cageCode, deleted: false });
            if (existed) {
                return res.status(400).json({ code: 400, message: "Mã chuồng đã tồn tại" });
            }
            (payload as any).cageCode = cageCode;
        }

        if ((payload as any).size !== undefined) {
            const normalizedSize = normalizeCageSize((payload as any).size);
            if (!normalizedSize) {
                return res.status(400).json({ code: 400, message: "Kích thước không hợp lệ" });
            }
            (payload as any).size = normalizedSize;
        }

        if ((payload as any).amenities !== undefined) {
            (payload as any).amenities = normalizeAmenities((payload as any).amenities);
        }
        if ((payload as any).gallery !== undefined) {
            (payload as any).gallery = normalizeImageList((payload as any).gallery);
        }

        const updated = await BoardingCage.findOneAndUpdate(
            { _id: id, deleted: false },
            payload,
            { new: true }
        );

        if (!updated) return res.status(404).json({ code: 404, message: "Không tìm thấy chuồng" });
        return res.json({ code: 200, message: "Cập nhật chuồng thành công", data: updated });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [DELETE] /api/v1/admin/boarding-cage/:id
export const deleteBoardingCage = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ code: 400, message: "ID không hợp lệ" });
        }

        // Kiểm tra xem chuồng có đang được sử dụng trong lịch lưu trú nào không
        const hasBooking = await BoardingBooking.exists({
            cageId: id,
            deleted: false
        });

        if (hasBooking) {
            return res.status(400).json({
                code: 400,
                message: "Không thể xóa chuồng này vì đang có lịch lưu trú liên quan!"
            });
        }

        const deleted = await BoardingCage.findOneAndUpdate(
            { _id: id, deleted: false },
            { deleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!deleted) return res.status(404).json({ code: 404, message: "Không tìm thấy chuồng" });
        return res.json({ code: 200, message: "Xóa chuồng thành công" });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

export const restoreBoardingCage = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        await BoardingCage.updateOne({ _id: id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.json({ code: 200, message: "Khôi phục chuồng thành công!" });
    } catch (e: any) {
        res.status(500).json({ code: 500, message: e.message || "Lỗi hệ thống!" });
    }
};

export const forceDeleteBoardingCage = async (req: Request, res: Response) => {
    try {
        const id = pickParam(req.params.id);
        await BoardingCage.deleteOne({ _id: id });
        res.json({ code: 200, message: "Xóa vĩnh viễn chuồng thành công!" });
    } catch (e: any) {
        res.status(500).json({ code: 500, message: e.message || "Lỗi hệ thống!" });
    }
};
