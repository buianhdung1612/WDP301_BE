import { Request, Response } from 'express';
import CategoryBlog from '../../models/category-blog.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import slugify from 'slugify';
import Blog from '../../models/blog.model';

// Danh mục
export const category = async (req: Request, res: Response) => {
    try {
        const find: {
            deleted: boolean;
            search?: RegExp;
        } = {
            deleted: false
        };

        // Tìm kiếm
        if (req.query.keyword) {
            const keyword = slugify(`${req.query.keyword}`, {
                replacement: " ",
                lower: true
            });

            const keywordRegex = new RegExp(keyword, "i");
            find.search = keywordRegex;
        }
        // Hết Tìm kiếm

        // Phân trang
        const limitItems = 20;
        let page = 1;
        if (req.query.page && parseInt(`${req.query.page}`) > 0) {
            page = parseInt(`${req.query.page}`);
        }

        const totalRecords = await CategoryBlog.countDocuments(find);
        const totalPages = Math.ceil(totalRecords / limitItems);
        const skip = (page - 1) * limitItems;

        const pagination = {
            totalRecords: totalRecords,
            totalPages: totalPages,
            skip: skip
        };
        // Hết Phân trang

        const recordList: any[] = await CategoryBlog
            .find(find)
            .sort({ createdAt: "desc" })
            .limit(limitItems)
            .skip(skip)
            .lean();

        const parentIds = recordList
            .filter(item => item.parent)
            .map(item => item.parent.toString());

        let parentMap: Record<string, string> = {};

        if (parentIds.length > 0) {
            const parents = await CategoryBlog
                .find({ _id: { $in: parentIds } })
                .select("name")
                .lean();

            for (const parent of parents) {
                parentMap[parent._id.toString()] = parent.name ?? "";
            }
        }

        for (const item of recordList) {
            if (item.parent) {
                item.parentName = parentMap[item.parent.toString()] || null;
            }
        }

        return res.json({
            success: true,
            message: "Lấy danh sách danh mục bài viết thành công",
            data: {
                recordList: recordList,
                pagination: pagination
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách danh mục bài viết"
        });
    }
};

export const getCategoryTree = async (req: Request, res: Response) => {
    try {
        const categories = await CategoryBlog.find({
            deleted: false
        }).lean();

        const categoryTree = buildCategoryTree(categories);

        return res.status(200).json({
            success: true,
            message: "Lấy danh mục bài viết dạng cây thành công",
            data: categoryTree
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh mục bài viết"
        });
    }
};

export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name, slug } = req.body;

        // 1. Check slug tồn tại
        const existSlug = await CategoryBlog.findOne({ slug });

        if (existSlug) {
            return res.status(400).json({
                success: false,
                message: "Đường dẫn đã tồn tại!"
            });
        }

        // 2. Generate search field
        req.body.search = slugify(name, {
            replacement: " ",
            lower: true,
            strict: true
        });

        // 3. Create category
        await CategoryBlog.create(req.body);

        return res.status(201).json({
            success: true,
            message: "Tạo danh mục thành công",
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
};

export const getCategoryDetail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const categoryDetail = await CategoryBlog
            .findOne({ _id: id, deleted: false })
            .lean();

        if (!categoryDetail) {
            return res.status(404).json({
                success: false,
                message: "Danh mục bài viết không tồn tại"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy chi tiết danh mục bài viết thành công",
            data: categoryDetail
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết danh mục bài viết"
        });
    }
};

export const editCategory = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const existSlug = await CategoryBlog.findOne({
            _id: { $ne: id }, // Loại trừ bản ghi có _id trùng với id truyền vào
            slug: req.body.slug
        }).lean();

        if (existSlug) {
            return res.status(400).json({
                success: false,
                message: "Đường dẫn đã tồn tại!"
            });
        }

        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true,
            strict: true
        })
        await CategoryBlog.updateOne({
            _id: id,
            deleted: false
        }, req.body)

        return res.status(200).json({
            success: true,
            message: "Cập nhật danh mục bài viết thành công"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Cập nhật danh mục bài viết thất bại"
        });
    }
}

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await CategoryBlog.updateOne({
            _id: id,
        }, {
            deleted: true,
            deletedAt: Date.now()
        })

        return res.status(200).json({
            success: true,
            message: "Xóa danh mục thành công!"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Id không hợp lệ hoặc lỗi hệ thống!"
        });
    }
}

// Bài viết
export const create = async (req: Request, res: Response) => {
    try {
        const existSlug = await Blog.findOne({
            slug: req.body.slug
        });

        if (existSlug) {
            return res.status(409).json({
                success: false,
                message: "Đường dẫn đã tồn tại!"
            });
        }

        if (req.body.category) {
            req.body.category = JSON.parse(req.body.category);
        }

        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true,
            strict: true
        })

        if (req.body.status === "published") {
            req.body.publishAt = new Date();
        }

        const newRecord = new Blog(req.body);
        await newRecord.save();

        return res.status(201).json({
            success: true,
            message: "Tạo bài viết thành công!"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const list = async (req: Request, res: Response) => {
    try {
        const find: {
            deleted: boolean;
            search?: RegExp;
        } = {
            deleted: false
        };

        // Tìm kiếm
        if (req.query.keyword) {
            const keyword = slugify(`${req.query.keyword}`, {
                replacement: " ",
                lower: true
            });

            const keywordRegex = new RegExp(keyword, "i");
            find.search = keywordRegex;
        }
        // Hết Tìm kiếm

        // Phân trang
        const limitItems = 20;
        let page = 1;
        if (req.query.page && parseInt(`${req.query.page}`) > 0) {
            page = parseInt(`${req.query.page}`);
        }

        const totalRecords = await Blog.countDocuments(find);
        const totalPages = Math.ceil(totalRecords / limitItems);
        const skip = (page - 1) * limitItems;

        const pagination = {
            totalRecords,
            totalPages,
            skip
        };
        // Hết Phân trang

        const recordList = await Blog
            .find(find)
            .sort({ createdAt: "desc" })
            .limit(limitItems)
            .skip(skip)
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách bài viết thành công",
            data: {
                recordList,
                pagination
            }
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

        const record = await Blog
            .findOne({
                _id: id,
                deleted: false
            })
            .lean();

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy chi tiết bài viết thành công",
            data: record
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết bài viết"
        });
    }
};

export const edit = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const articleDetail = await Blog.findOne({
            _id: id,
            deleted: false
        })

        if (!articleDetail) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại!"
            });
        }

        const existSlug = await Blog.findOne({
            _id: { $ne: id },
            slug: req.body.slug
        });

        if (existSlug) {
            return res.status(409).json({
                success: false,
                message: "Đường dẫn đã tồn tại!"
            });
        }
        if (req.body.category) {
            req.body.category = JSON.parse(req.body.category);
        }

        req.body.search = slugify(req.body.name, {
            replacement: " ",
            lower: true,
            strict: true
        });

        if (req.body.status === "published") {
            req.body.publishAt = new Date();
        }

        await Blog.updateOne({
            _id: id,
            deleted: false
        }, req.body)

        return res.status(200).json({
            success: true,
            message: "Cập nhật bài viết thành công!"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const deleteBlog = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const articleDetail = await Blog.findOne({
            _id: id,
            deleted: false
        });

        if (!articleDetail) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại!"
            });
        }

        await Blog.updateOne({
            _id: id,
        }, {
            deleted: true,
            deletedAt: Date.now()
        })

        return res.status(200).json({
            success: true,
            message: "Xóa bài viết thành công!"
        });
    } catch (error) {
        console.error(error);

        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ!"
        });
    }
}