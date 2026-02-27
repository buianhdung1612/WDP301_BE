import { Request, Response } from "express";
import mongoose from "mongoose";
import BoardingCage from "../../models/boarding-cage.model";

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

// [GET] /api/v1/admin/boarding-cage
export const listBoardingCages = async (req: Request, res: Response) => {
    try {
        const { search, type, size, status } = req.query as Record<string, string>;
        const filter: any = { deleted: false };

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

        const cages = await BoardingCage.find(filter).sort({ createdAt: -1 });
        return res.json({ code: 200, data: cages });
    } catch (error: any) {
        return res.status(500).json({ code: 500, message: error.message || "Lỗi hệ thống" });
    }
};

// [POST] /api/v1/admin/boarding-cage/create
export const createBoardingCage = async (req: Request, res: Response) => {
    try {
        const { cageCode, type, size, maxWeightCapacity, dailyPrice, avatar, description, amenities, status } = req.body;
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
