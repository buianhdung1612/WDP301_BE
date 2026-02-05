import { Request, Response } from 'express';
import Coupon from '../../models/coupon.model';
import moment from 'moment';
import { convertToSlug } from '../../helpers/slug.helper';

export const create = async (req: Request, res: Response) => {
    try {
        const {
            code,
            name,
            value,
            minOrderValue,
            maxDiscountValue,
            usageLimit,
            startDate,
            endDate,
            ...rest
        } = req.body;

        // Check trùng mã
        const isExist = await Coupon.exists({
            code,
            deleted: false
        });

        if (isExist) {
            return res.status(409).json({
                success: false,
                message: "Mã giảm giá đã tồn tại!"
            });
        }

        const payload = {
            ...rest,
            code,
            name,
            value: Number(value) || 0,
            minOrderValue: Number(minOrderValue) || 0,
            maxDiscountValue: Number(maxDiscountValue) || 0,
            usageLimit: Number(usageLimit) || 0,
            startDate: startDate
                ? moment(startDate, "DD/MM/YYYY").toDate()
                : undefined,
            endDate: endDate
                ? moment(endDate, "DD/MM/YYYY").toDate()
                : undefined,
            search: convertToSlug(`${code} ${name}`).replace(/-/g, " ")

        };

        await Coupon.create(payload);

        return res.status(201).json({
            success: true,
            message: "Đã tạo mã giảm giá thành công"
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ"
        });
    }
};

export const list = async (req: Request, res: Response) => {
    try {
        const find: {
            deleted: boolean;
            search?: RegExp;
        } = {
            deleted: false
        };

        // Search
        if (req.query.keyword) {
            const keyword = convertToSlug(`${req.query.keyword}`).replace(/-/g, " ");
            find.search = new RegExp(keyword, "i");
        }

        const recordList = await Coupon.find(find)
            .sort({ createdAt: -1 })
            .lean();

        const formattedList = recordList.map(item => ({
            ...item,
            startDateFormat: item.startDate
                ? moment(item.startDate).format("DD/MM/YYYY")
                : undefined,
            endDateFormat: item.endDate
                ? moment(item.endDate).format("DD/MM/YYYY")
                : undefined,
        }));

        return res.status(200).json({
            success: true,
            message: "Lấy danh mã giảm giá thành công",
            data: formattedList
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách bài viết"
        });
    }
};

export const detail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const record = await Coupon.findOne({
            _id: id,
            deleted: false
        }).lean();

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy mã giảm giá"
            });
        }

        const formattedRecord = {
            ...record,
            startDateFormat: record.startDate
                ? moment(record.startDate).format("DD/MM/YYYY")
                : undefined,
            endDateFormat: record.endDate
                ? moment(record.endDate).format("DD/MM/YYYY")
                : undefined,
        };

        return res.status(200).json({
            success: true,
            message: "Lấy chi tiết mã giảm giá thành công",
            data: formattedRecord
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết mã giảm giá"
        });
    }
};

export const edit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const {
            code,
            name,
            value,
            minOrderValue,
            maxDiscountValue,
            usageLimit,
            startDate,
            endDate,
            ...rest
        } = req.body;

        // Check tồn tại bản ghi
        const isExist = await Coupon.exists({
            _id: id,
            deleted: false
        });

        if (!isExist) {
            return res.status(404).json({
                success: false,
                message: "Id không tồn tại"
            });
        }

        // Check trùng code
        const isDuplicate = await Coupon.exists({
            _id: { $ne: id },
            code,
            deleted: false
        });

        if (isDuplicate) {
            return res.status(409).json({
                success: false,
                message: "Mã giảm giá đã tồn tại"
            });
        }

        const payload = {
            ...rest,
            code,
            name,
            value: Number(value) || 0,
            minOrderValue: Number(minOrderValue) || 0,
            maxDiscountValue: Number(maxDiscountValue) || 0,
            usageLimit: Number(usageLimit) || 0,
            startDate: startDate
                ? moment(startDate, "DD/MM/YYYY").toDate()
                : undefined,
            endDate: endDate
                ? moment(endDate, "DD/MM/YYYY").toDate()
                : undefined,
            search: convertToSlug(`${code} ${name}`).replace(/-/g, " ")

        };
        await Coupon.updateOne(
            { _id: id, deleted: false },
            payload
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật mã giảm giá thành công"
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ"
        });
    }
};

export const deletePatch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const isExist = await Coupon.exists({
            _id: id,
            deleted: false
        });

        if (!isExist) {
            return res.status(404).json({
                success: false,
                message: "Mã giảm giá không tồn tại hoặc đã bị xóa"
            });
        }

        await Coupon.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: Date.now(),
        });

        return res.status(200).json({
            success: true,
            message: "Xóa mã giảm giá thành công"
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ"
        });
    }
}