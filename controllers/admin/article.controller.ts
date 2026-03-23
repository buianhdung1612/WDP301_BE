import { Request, Response } from 'express';
import CategoryBlog from '../../models/category-blog.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import Blog from '../../models/blog.model';
import { convertToSlug } from '../../helpers/slug.helper';

// Danh mục
export const category = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: req.query.is_trash === "true" ? true : false
        };

        // Tìm kiếm
        const keyword = req.query.keyword || req.query.q;
        if (keyword) {
            const slugKeyword = convertToSlug(`${keyword}`).replace(/-/g, " ");
            const regex = new RegExp(`${keyword}`, "i");
            find.$or = [
                { search: new RegExp(slugKeyword, "i") },
                { name: regex }
            ];
        }

        if (req.query.status) {
            const statusArr = (req.query.status as string).split(',');
            find.status = { $in: statusArr };
        }

        // Phân trang
        const limitItems = parseInt(req.query.limit as string) || 20;
        let page = 1;
        if (req.query.page && parseInt(`${req.query.page}`) > 0) {
            page = parseInt(`${req.query.page}`);
        }

        const [recordList, totalRecords, deletedCount] = await Promise.all([
            CategoryBlog.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip((page - 1) * limitItems)
                .lean(),
            CategoryBlog.countDocuments(find),
            CategoryBlog.countDocuments({ deleted: true })
        ]);

        const pagination = {
            totalRecords,
            totalPages: Math.ceil(totalRecords / limitItems),
            currentPage: page,
            limit: limitItems,
            deletedCount
        };
        // Hết Phân trang


        const parentIds = recordList
            .filter((item: any) => item.parent)
            .map((item: any) => item.parent.toString());

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

        for (const item of recordList as any[]) {
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
        const { name } = req.body;

        let slug = req.body.slug || convertToSlug(name);

        let slugCheck = await CategoryBlog.findOne({ slug, deleted: false });
        let count = 1;
        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await CategoryBlog.findOne({ slug, deleted: false });
            count++;
        }

        req.body.slug = slug;

        // 2. Generate search field
        req.body.search = convertToSlug(name).replace(/-/g, " ");

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

        if (req.body.name && !req.body.slug) {
            req.body.slug = convertToSlug(req.body.name);
        }

        if (req.body.slug) {
            let slug = req.body.slug;
            let slugCheck = await CategoryBlog.findOne({
                _id: { $ne: id },
                slug: slug,
                deleted: false
            }).lean();

            let count = 1;
            const originalSlug = slug;
            while (slugCheck) {
                slug = `${originalSlug}-${count}`;
                slugCheck = await CategoryBlog.findOne({
                    _id: { $ne: id },
                    slug: slug,
                    deleted: false
                }).lean();
                count++;
            }
            req.body.slug = slug;
        }

        req.body.search = convertToSlug(req.body.name || "").replace(/-/g, " ");
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

        // Kiểm tra xem có bài viết nào thuộc danh mục này không
        const hasBlog = await Blog.exists({
            category: id,
            deleted: false
        });

        if (hasBlog) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa danh mục này vì vẫn còn bài viết đang sử dụng!"
            });
        }

        await CategoryBlog.updateOne({
            _id: id,
        }, {
            deleted: true,
            deletedAt: Date.now(),
            status: 'inactive'
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

export const restoreCategory = async (req: Request, res: Response) => {
    try {
        await CategoryBlog.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.status(200).json({ success: true, message: "Khôi phục danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

export const forceDeleteCategory = async (req: Request, res: Response) => {
    try {
        await CategoryBlog.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: "Xóa vĩnh viễn danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

// Bài viết
export const create = async (req: Request, res: Response) => {
    try {
        let slug = req.body.slug || convertToSlug(req.body.name);

        let slugCheck = await Blog.findOne({
            slug: slug,
            deleted: false
        });

        let count = 1;
        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await Blog.findOne({
                slug: slug,
                deleted: false
            });
            count++;
        }

        req.body.slug = slug;

        if (req.body.category) {
            req.body.category = JSON.parse(req.body.category);
        }

        req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");

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
        const find: any = {
            deleted: req.query.is_trash === "true" ? true : false
        };

        // Tìm kiếm
        const keyword = req.query.keyword || req.query.q;
        if (keyword) {
            const slugKeyword = convertToSlug(`${keyword}`).replace(/-/g, " ");
            const regex = new RegExp(`${keyword}`, "i");
            find.$or = [
                { search: new RegExp(slugKeyword, "i") },
                { title: regex },
                { name: regex } // In case it's name not title, though Blog usually has title
            ];
        }

        if (req.query.status) {
            const statusArr = (req.query.status as string).split(',');
            find.status = { $in: statusArr };
        }

        // Phân trang
        const limitItems = parseInt(req.query.limit as string) || 20;
        let page = 1;
        if (req.query.page && parseInt(`${req.query.page}`) > 0) {
            page = parseInt(`${req.query.page}`);
        }

        const [recordList, totalRecords, deletedCount] = await Promise.all([
            Blog.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip((page - 1) * limitItems)
                .lean(),
            Blog.countDocuments(find),
            Blog.countDocuments({ deleted: true })
        ]);

        const pagination = {
            totalRecords,
            totalPages: Math.ceil(totalRecords / limitItems),
            currentPage: page,
            limit: limitItems,
            deletedCount
        };

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

        if (req.body.name && !req.body.slug) {
            req.body.slug = convertToSlug(req.body.name);
        }

        if (req.body.slug) {
            let slug = req.body.slug;
            let slugCheck = await Blog.findOne({
                _id: { $ne: id },
                slug: slug,
                deleted: false
            });

            let count = 1;
            const originalSlug = slug;
            while (slugCheck) {
                slug = `${originalSlug}-${count}`;
                slugCheck = await Blog.findOne({
                    _id: { $ne: id },
                    slug: slug,
                    deleted: false
                });
                count++;
            }
            req.body.slug = slug;
        }
        if (req.body.category) {
            try {
                if (typeof req.body.category === 'string') {
                    req.body.category = JSON.parse(req.body.category);
                }
            } catch (e) {
                console.error("Error parsing category:", e);
                // Keep as is or handle if it's already an array
            }
        }

        if (req.body.name) {
            req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");
        }

        if (req.body.status === "published") {
            req.body.publishAt = new Date();
        }

        // Clean up fields that shouldn't be in the update payload
        delete req.body._id;
        delete req.body.id;
        delete req.body.createdAt;
        delete req.body.updatedAt;

        const updateResult = await Blog.updateOne({
            _id: id,
            deleted: false
        }, req.body);

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bài viết để cập nhật!"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật bài viết thành công!"
        });
    } catch (error) {
        console.error("Error in edit blog:", error);

        return res.status(500).json({
            success: false,
            message: "Dữ liệu không hợp lệ hoặc lỗi hệ thống!"
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
            deletedAt: Date.now(),
            status: 'archived'
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

export const restoreBlog = async (req: Request, res: Response) => {
    try {
        await Blog.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.status(200).json({ success: true, message: "Khôi phục bài viết thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

export const forceDeleteBlog = async (req: Request, res: Response) => {
    try {
        await Blog.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: "Xóa vĩnh viễn bài viết thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};