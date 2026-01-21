import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import slugify from 'slugify';
import { buildCategoryTree } from '../../helpers/category.helper';
import AttributeProduct from '../../models/attribute-product.model';


// Danh mục sản phẩm
export const category = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false
        };

        // Tìm kiếm
        if (req.query.keyword) {
            const keyword = slugify(`${req.query.keyword}`, {
                replacement: " ",
                lower: true
            });
            find.search = new RegExp(keyword, "i");
        }

        // Phân trang
        const limitItems = 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords] = await Promise.all([
            CategoryProduct.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            CategoryProduct.countDocuments(find)
        ]);

        const parentIds = recordList
            .map(item => item.parent?.toString())
            .filter((id): id is string => !!id);

        let parentMap: Record<string, string> = {};

        if (parentIds.length > 0) {
            const parents = await CategoryProduct
                .find({ _id: { $in: parentIds } })
                .select("name")
                .lean();

            for (const parent of parents) {
                parentMap[parent._id.toString()] = (parent as any).name ?? "";
            }
        }

        const formattedList = recordList.map(item => ({
            ...item,
            parentName: item.parent ? parentMap[item.parent.toString()] || null : null,
        }));

        return res.json({
            success: true,
            message: "Lấy danh sách danh mục thành công",
            data: {
                recordList: formattedList,
                pagination: {
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limitItems),
                    currentPage: page,
                    limit: limitItems
                }
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh mục"
        });
    }
}

export const getCategoryTree = async (req: Request, res: Response) => {
    try {
const categories = await CategoryProduct.find({
            deleted: false
        }).select("name parent slug avatar status").lean();

        const tree = buildCategoryTree(categories, "");

        return res.json({
            success: true,
            message: "Lấy cấu trúc cây danh mục thành công",
            data: tree
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
}

export const createCategory = async (req: Request, res: Response) => {
    try {
        let slug = req.body.slug;
        if (!slug || slug.trim() === "") {
            slug = slugify(`${req.body.name}`, { lower: true, strict: true });
        }

        const existSlug = await CategoryProduct.findOne({
            slug: slug,
            deleted: false
        });

        if (existSlug) {
            return res.json({
                code: "error",
                message: "Đường dẫn đã tồn tại!"
            });
        }

        // Nếu parent là chuỗi rỗng hoặc "null", chuyển về undefined/null để database nhận diện đúng là cấp cha
        if (!req.body.parent || req.body.parent === "") {
            delete req.body.parent;
        }

        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true
        });

        req.body.slug = slug;

        const newRecord = new CategoryProduct(req.body);
        await newRecord.save();

        res.json({
            success: true,
            message: "Tạo danh mục thành công"
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ hoặc lỗi hệ thống!"
        });
    }
}

export const getCategoryDetail = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const categoryDetail = await CategoryProduct.findOne({
            _id: id,
            deleted: false
        }).lean();

        if (!categoryDetail) {
            return res.status(404).json({
                code: "error",
                message: "Không tìm thấy danh mục!"
            });
        }

        return res.json({
            success: true,
            message: "Lấy chi tiết danh mục thành công",
            data: categoryDetail
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "ID không hợp lệ!"
        });
    }
}

export const editCategory = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const existSlug = await CategoryProduct.findOne({
            _id: { $ne: id }, // Loại trừ bản ghi có _id trùng với id truyền vào
            slug: req.body.slug
        });

        if (existSlug) {
            res.json({
                code: "error",
message: "Đường dẫn đã tồn tại!"
            });

            return;
        }

        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true
        })

        await CategoryProduct.updateOne({
            _id: id,
            deleted: false
        }, req.body)

        return res.json({
            success: true,
            message: "Cập nhật thành công!"
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        })
    }
}

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await CategoryProduct.updateOne({
            _id: id,
        }, {
            deleted: true,
            deletedAt: Date.now()
        })

        return res.json({
            success: true,
            message: "Xóa danh mục thành công!"
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ!"
        })
    }
}
export const getAttributeList = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false
        };

        if (req.query.keyword) {
            const keyword = slugify(`${req.query.keyword}`, {
                replacement: ' ',
                lower: true,
            });
            find.search = new RegExp(keyword, "i");
        }

        const limitItems = 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords] = await Promise.all([
            AttributeProduct.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip),
            AttributeProduct.countDocuments(find)
        ]);

        return res.json({
            success: true,
            message: "Lấy danh sách thuộc tính thành công",
            data: {
                recordList: recordList,
                pagination: {
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limitItems),
                    currentPage: page,
                    limit: limitItems
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

export const createAttribute = async (req: Request, res: Response) => {
    try {
        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true
        });

        const newRecord = new AttributeProduct(req.body);
        await newRecord.save();

        return res.json({
            success: true,
            message: "Tạo thuộc tính thành công!",
            data: newRecord
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const getAttributeDetail = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const attributeDetail = await AttributeProduct.findOne({
            _id: id,
            deleted: false
        });

        if (!attributeDetail) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thuộc tính!"
            });
        }

        return res.json({
            success: true,
            message: "Lấy chi tiết thuộc tính thành công",
            data: attributeDetail
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "ID không hợp lệ!"
        });
    }
}

export const updateAttribute = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        req.body.search = slugify(req.body.name, {
            replacement: ' ',
            lower: true,
        });

        await AttributeProduct.updateOne({
            _id: id,
            deleted: false
        }, req.body);

        return res.json({
            success: true,
            message: "Cập nhật thuộc tính thành công!"
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const deleteAttribute = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        await AttributeProduct.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: Date.now(),
        });

        return res.json({
            success: true,
            message: "Xóa thuộc tính thành công!"
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ!"
        });
    }
}
