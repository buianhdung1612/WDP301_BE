import { Request, Response } from 'express';
import Brand from '../../models/brand.model';
import slugify from 'slugify';

export const create = async (req: Request, res: Response) => {
    try {
        const {
            name,
            slug,
            ...rest
        } = req.body;

        let finalSlug = slug;
        if (!finalSlug || finalSlug.trim() === "") {
            finalSlug = slugify(`${name}`, { lower: true, strict: true });
        }

        // Check trùng slug
        const isExist = await Brand.exists({
            slug: finalSlug,
            deleted: false
        });

        if (isExist) {
            return res.status(409).json({
                success: false,
                message: "Đường dẫn đã tồn tại!"
            });
        }

        const payload = {
            ...rest,
            name,
            slug: finalSlug,
            search: slugify(`${name}`, {
                replacement: " ",
                lower: true
            })
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
            const keyword = slugify(`${req.query.keyword}`, {
                replacement: ' ',
                lower: true,
            });
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

        let finalSlug = slug;
        if (!finalSlug || finalSlug.trim() === "") {
            finalSlug = slugify(`${name}`, { lower: true, strict: true });
        }

        // Check trùng slug
        const isDuplicate = await Brand.exists({
            _id: { $ne: id },
            slug: finalSlug,
            deleted: false
        });

        if (isDuplicate) {
            return res.status(409).json({
                success: false,
                message: "Đường dẫn đã tồn tại"
            });
        }

        const payload = {
            ...rest,
            name,
            slug: finalSlug,
            search: slugify(`${name}`, {
                replacement: " ",
                lower: true
            })
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