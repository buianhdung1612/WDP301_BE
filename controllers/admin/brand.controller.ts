import { Request, Response } from 'express';
import Brand from '../../models/brand.model';
import { convertToSlug } from '../../helpers/slug.helper';

export const create = async (req: Request, res: Response) => {
    try {
        const {
            name,
            slug,
            ...rest
        } = req.body;

        let finalSlug = slug || convertToSlug(name);

        // Logic tự động xử lý slug trùng
        let slugCheck = await Brand.findOne({ slug: finalSlug, deleted: false }).lean();
        let count = 1;
        const originalSlug = finalSlug;
        while (slugCheck) {
            finalSlug = `${originalSlug}-${count}`;
            slugCheck = await Brand.findOne({ slug: finalSlug, deleted: false }).lean();
            count++;
        }

        const payload = {
            ...rest,
            name,
            slug: finalSlug,
            search: convertToSlug(name).replace(/-/g, " ")
        };

        await Brand.create(payload);

        return res.status(201).json({
            success: true,
            message: "Đã tạo thương hiệu thành công"
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

        const recordList = await Brand.find(find)
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách thương hiệu thành công",
            data: recordList
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách thương hiệu"
        });
    }
};

export const detail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const record = await Brand.findOne({
            _id: id,
            deleted: false
        }).lean();

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thương hiệu"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy chi tiết thương hiệu thành công",
            data: record
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết thương hiệu"
        });
    }
};

export const edit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const {
            name,
            slug,
            ...rest
        } = req.body;

        // Check tồn tại bản ghi
        const isExist = await Brand.exists({
            _id: id,
            deleted: false
        });

        if (!isExist) {
            return res.status(404).json({
                success: false,
                message: "Id không tồn tại"
            });
        }

        let finalSlug = slug || convertToSlug(name);

        // Check trùng slug
        let slugCheck = await Brand.findOne({
            _id: { $ne: id },
            slug: finalSlug,
            deleted: false
        }).lean();

        let count = 1;
        const originalSlug = finalSlug;
        while (slugCheck) {
            finalSlug = `${originalSlug}-${count}`;
            slugCheck = await Brand.findOne({
                _id: { $ne: id },
                slug: finalSlug,
                deleted: false
            }).lean();
            count++;
        }

        const payload = {
            ...rest,
            name,
            slug: finalSlug,
            search: convertToSlug(name || "").replace(/-/g, " ")
        };

        await Brand.updateOne(
            { _id: id, deleted: false },
            payload
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật thương hiệu thành công"
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

        const isExist = await Brand.exists({
            _id: id,
            deleted: false
        });

        if (!isExist) {
            return res.status(404).json({
                success: false,
                message: "Thương hiệu không tồn tại hoặc đã bị xóa"
            });
        }

        await Brand.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: Date.now(),
        });

        return res.status(200).json({
            success: true,
            message: "Xóa thương hiệu thành công"
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ"
        });
    }
}