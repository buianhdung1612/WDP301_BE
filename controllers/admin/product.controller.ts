import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import AttributeProduct from '../../models/attribute-product.model';
import Product from '../../models/product.model';
import { generateRandomString } from '../../helpers/generate.helper';
import { convertToSlug } from '../../helpers/slug.helper';
import Brand from '../../models/brand.model';
import ExpiredProduct from '../../models/expired-product.model';
import Order from '../../models/order.model';
import { handleProductExpiry } from '../../helpers/expiry.helper';

// Danh mục sản phẩm
export const category = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: req.query.is_trash === "true" ? true : false
        };

        // Tìm kiếm
        if (req.query.keyword) {
            const keyword = String(req.query.keyword);
            const slugKeyword = convertToSlug(keyword).replace(/-/g, " ");
            const regex = new RegExp(keyword, "i");
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
        const limitItems = 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords, deletedCount] = await Promise.all([
            CategoryProduct.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            CategoryProduct.countDocuments(find),
            CategoryProduct.countDocuments({ deleted: true })
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
                    limit: limitItems,
                    deletedCount
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
        // 1. Generate slug
        let slug = req.body.slug || convertToSlug(req.body.name);
        let slugCheck = await CategoryProduct.findOne({ slug, deleted: false });
        let count = 1;

        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await CategoryProduct.findOne({ slug, deleted: false });
            count++;
        }

        req.body.slug = slug;
        req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");

        // Nếu parent là chuỗi rỗng hoặc "null", chuyển về undefined/null để database nhận diện đúng là cấp cha
        if (!req.body.parent || req.body.parent === "") {
            delete req.body.parent;
        }

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

        if (req.body.name && !req.body.slug) {
            req.body.slug = convertToSlug(req.body.name);
        }

        if (req.body.slug) {
            let slug = req.body.slug;
            let slugCheck = await CategoryProduct.findOne({ _id: { $ne: id }, slug: slug, deleted: false }).lean();
            let count = 1;
            const originalSlug = slug;
            while (slugCheck) {
                slug = `${originalSlug}-${count}`;
                slugCheck = await CategoryProduct.findOne({ _id: { $ne: id }, slug: slug, deleted: false }).lean();
                count++;
            }
            req.body.slug = slug;
        }

        if (req.body.name) {
            req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");
        }

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

        // Kiểm tra xem có danh mục con không
        const hasChildCategory = await CategoryProduct.exists({
            parent: id,
            deleted: false
        });

        if (hasChildCategory) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa danh mục này vì vẫn còn danh mục con bên trong!"
            });
        }

        // Kiểm tra xem có sản phẩm nào thuộc danh mục này không
        const hasProduct = await Product.exists({
            category: id,
            deleted: false
        });

        if (hasProduct) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa danh mục này vì vẫn còn sản phẩm thuộc danh mục!"
            });
        }

        await CategoryProduct.updateOne({
            _id: id,
        }, {
            deleted: true,
            deletedAt: Date.now(),
            status: 'inactive'
        });

        return res.json({
            success: true,
            message: "Xóa danh mục thành công!"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Id không hợp lệ!"
        });
    }
};

export const restoreCategory = async (req: Request, res: Response) => {
    try {
        await CategoryProduct.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.json({ success: true, message: "Khôi phục danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

export const forceDeleteCategory = async (req: Request, res: Response) => {
    try {
        // Có thể cần kiểm tra guard ở đây nếu yêu cầu an toàn tuyệt đối
        await CategoryProduct.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: "Xóa vĩnh viễn danh mục thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

// Sản phẩm
export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: req.query.is_trash === "true" ? true : false
        };

        if (req.query.status && req.query.status !== 'all') {
            const statusArr = Array.isArray(req.query.status)
                ? req.query.status
                : (typeof req.query.status === 'string' ? req.query.status.split(',') : [req.query.status]);

            find.status = { $in: statusArr };
        }

        const keyword = req.query.keyword || req.query.q;
        if (keyword) {
            const slugKeyword = convertToSlug(`${keyword}`).replace(/-/g, " ");
            const keywordRegex = new RegExp(String(keyword), "i");
            find.$or = [
                { search: new RegExp(slugKeyword, "i") },
                { name: keywordRegex },
                { sku: keywordRegex }
            ];
        }

        const limitItems = parseInt(`${req.query.limit}`) || 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [
            recordList,
            totalRecord,
            activeCount,
            draftCount,
            inactiveCount,
            deletedCount
        ] = await Promise.all([
            Product.find(find)
                .sort({ position: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            Product.countDocuments(find),
            Product.countDocuments({ status: 'active', deleted: false }),
            Product.countDocuments({ status: 'draft', deleted: false }),
            Product.countDocuments({ status: 'inactive', deleted: false }),
            Product.countDocuments({ deleted: true })
        ]);

        // Get category names
        const categoryIds = recordList.flatMap(item => item.category || []);
        const categories = await CategoryProduct.find({ _id: { $in: categoryIds } }).select("name").lean();
        const categoryMap = categories.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = cur.name;
            return acc;
        }, {});

        // Get brand names
        const brandIds = recordList.map(item => item.brandId).filter(id => !!id);
        const brands = await Brand.find({ _id: { $in: brandIds } }).select("name").lean();
        const brandMap = brands.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = cur.name;
            return acc;
        }, {});

        const recordListWithInfo = recordList.map(item => ({
            ...item,
            categoryInfo: (item.category || []).map((id: any) => ({
                id,
                name: categoryMap[id.toString()] || "N/A"
            })),
            brandName: item.brandId ? brandMap[item.brandId.toString()] || "N/A" : "N/A"
        }));

        return res.json({
            success: true,
            message: "Lấy danh sách sản phẩm thành công",
            data: {
                recordList: recordListWithInfo,
                pagination: {
                    totalRecords: totalRecord,
                    totalPages: Math.ceil(totalRecord / limitItems),
                    currentPage: page,
                    limit: limitItems,
                    activeCount,
                    draftCount,
                    inactiveCount,
                    deletedCount
                }
            }
        });
    } catch (error) {
        console.error("Error in list product:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách sản phẩm"
        });
    }
}

export const create = async (req: Request, res: Response) => {
    try {
        const [categoryList, attributeList, productList] = await Promise.all([
            CategoryProduct.find({ deleted: false }).lean(),
            AttributeProduct.find({ deleted: false }).lean(),
            Product.find({ deleted: false, status: 'active' })
                .sort({ position: 'desc' })
                .select("id name")
                .lean()
        ]);

        const categoryTree = buildCategoryTree(categoryList);

        return res.json({
            success: true,
            message: "Lấy dữ liệu tạo sản phẩm thành công",
            data: {
                categoryList: categoryTree,
                attributeList: attributeList,
                productList: productList
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống!"
        });
    }
}

const parseIfString = (val: any) => {
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (e) {
            return val;
        }
    }
    return val;
};

export const createPost = async (req: Request, res: Response) => {
    try {
        let slug = req.body.slug || convertToSlug(req.body.name);

        let slugCheck = await Product.findOne({
            slug: slug,
            deleted: false
        }).lean();

        let count = 1;
        const originalSlug = slug;
        while (slugCheck) {
            slug = `${originalSlug}-${count}`;
            slugCheck = await Product.findOne({
                slug: slug,
                deleted: false
            }).lean();
            count++;
        }

        req.body.slug = slug;

        if (req.body.position) {
            req.body.position = parseInt(req.body.position);
        } else {
            const recordMaxPosition = await Product
                .findOne({})
                .sort({ position: "desc" })
                .select("position")
                .lean();

            req.body.position = (recordMaxPosition?.position ?? 0) + 1;
        }

        // Parse fields
        req.body.category = parseIfString(req.body.category);
        req.body.images = parseIfString(req.body.images);
        req.body.attributes = parseIfString(req.body.attributes);
        req.body.variants = parseIfString(req.body.variants);

        req.body.search = convertToSlug(`${req.body.name}`).replace(/-/g, " ");

        if (req.body.priceOld) {
            req.body.priceOld = parseInt(req.body.priceOld);
        }

        if (req.body.priceNew) {
            req.body.priceNew = parseInt(req.body.priceNew);
            if (req.body.priceOld > 0) {
                req.body.discount = Math.floor(((req.body.priceOld - req.body.priceNew) / req.body.priceOld) * 100);
            } else {
                req.body.discount = 0;
            }
        } else {
            req.body.priceNew = req.body.priceOld || 0;
            req.body.discount = 0;
        }

        if (req.body.stock) {
            req.body.stock = parseInt(req.body.stock);
        }

        req.body.sku = generateRandomString(10).toUpperCase();

        // Handle food and expiry
        if (req.body.isFood === 'true' || req.body.isFood === true) {
            req.body.isFood = true;
            if (req.body.expiryDate) {
                req.body.expiryDate = new Date(req.body.expiryDate);
            }
        } else {
            req.body.isFood = false;
            req.body.expiryDate = null;
        }

        if (req.body.name) {
            req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");
        }

        const newRecord = new Product(req.body);
        await newRecord.save();

        return res.json({
            success: true,
            code: "success",
            message: "Tạo sản phẩm thành công!",
            data: newRecord
        });
    } catch (error) {
        console.error("Error in create product:", error);
        return res.status(400).json({
            success: false,
            code: "error",
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const edit = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const [productDetail, categoryList, attributeList] = await Promise.all([
            Product.findOne({ _id: id, deleted: false }).lean(),
            CategoryProduct.find({ deleted: false }).lean(),
            AttributeProduct.find({ deleted: false }).lean()
        ]);

        if (!productDetail) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm!"
            });
        }

        const categoryTree = buildCategoryTree(categoryList);

        // Thuộc tính đã chọn
        const attributeNameList: string[] = [];
        if (productDetail.attributes) {
            productDetail.attributes.forEach((attrId: any) => {
                const attributeInfo = attributeList.find(item => item._id.toString() === attrId.toString());
                if (attributeInfo) {
                    attributeNameList.push(`${attributeInfo.name}`);
                }
            });
        }

        return res.json({
            success: true,
            message: "Lấy chi tiết sản phẩm thành công",
            data: {
                productDetail,
                categoryList: categoryTree,
                attributeList: attributeList,
                attributeNameList: attributeNameList
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "ID không hợp lệ!"
        });
    }
}

export const editPatch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        const productDetail = await Product.findOne({
            _id: id,
            deleted: false
        }).lean();

        if (!productDetail) {
            return res.status(404).json({
                success: false,
                code: 'error',
                message: "Sản phẩm không tồn tại!"
            });
        }

        if (req.body.name && !req.body.slug) {
            req.body.slug = convertToSlug(req.body.name);
        }

        if (req.body.slug && req.body.slug !== productDetail.slug) {
            let slug = req.body.slug;
            let slugCheck = await Product.findOne({
                _id: { $ne: id },
                slug: slug,
                deleted: false
            }).lean();

            let count = 1;
            const originalSlug = slug;
            while (slugCheck) {
                slug = `${originalSlug}-${count}`;
                slugCheck = await Product.findOne({
                    _id: { $ne: id },
                    slug: slug,
                    deleted: false
                }).lean();
                count++;
            }
            req.body.slug = slug;
        }

        if (req.body.position) {
            req.body.position = parseInt(req.body.position);
        }

        // Parse fields
        req.body.category = parseIfString(req.body.category);
        req.body.images = parseIfString(req.body.images);
        req.body.attributes = parseIfString(req.body.attributes);
        req.body.variants = parseIfString(req.body.variants);

        if (req.body.name) {
            req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");
        }

        // Discount calculation logic
        if (req.body.priceOld !== undefined || req.body.priceNew !== undefined) {
            const pOld = req.body.priceOld !== undefined ? parseInt(req.body.priceOld) : (productDetail.priceOld || 0);
            const pNew = req.body.priceNew !== undefined ? parseInt(req.body.priceNew) : (productDetail.priceNew || pOld);

            req.body.priceOld = pOld;
            req.body.priceNew = pNew;

            if (pOld > 0) {
                req.body.discount = Math.floor(((pOld - pNew) / pOld) * 100);
            } else {
                req.body.discount = 0;
            }
        }

        if (req.body.stock) {
            req.body.stock = parseInt(req.body.stock);
        }

        if (!productDetail.sku && !req.body.sku) {
            req.body.sku = generateRandomString(10).toUpperCase();
        }

        // Handle food and expiry
        if (req.body.isFood !== undefined) {
            if (req.body.isFood === 'true' || req.body.isFood === true) {
                req.body.isFood = true;
                if (req.body.expiryDate) {
                    req.body.expiryDate = new Date(req.body.expiryDate);
                }
            } else {
                req.body.isFood = false;
                req.body.expiryDate = null;
            }
        }

        await Product.updateOne({
            _id: id,
            deleted: false
        }, req.body);

        return res.json({
            success: true,
            code: "success",
            message: "Cập nhật sản phẩm thành công!"
        });
    } catch (error) {
        console.error("Error in editPatch product:", error);
        return res.status(400).json({
            success: false,
            code: 'error',
            message: "Dữ liệu không hợp lệ!"
        });
    }
}

export const deletePatch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;

        // Kiểm tra xem sản phẩm có nằm trong đơn hàng nào không
        const isInOrder = await Order.exists({
            "items.productId": id,
            deleted: false
        });

        if (isInOrder) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa sản phẩm này vì đã có trong đơn hàng của khách!"
            });
        }

        await Product.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: new Date(),
            status: 'inactive'
        });

        return res.json({
            success: true,
            code: "success",
            message: "Xóa sản phẩm thành công!"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            code: "error",
            message: "Id không hợp lệ!"
        });
    }
}

export const restoreProduct = async (req: Request, res: Response) => {
    try {
        await Product.updateOne({ _id: req.params.id }, { $set: { deleted: false }, $unset: { deletedAt: 1 } });
        res.json({ success: true, message: "Khôi phục sản phẩm thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

export const forceDeleteProduct = async (req: Request, res: Response) => {
    try {
        await Product.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: "Xóa vĩnh viễn sản phẩm thành công!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }
};

// Thuộc tính
export const getAttributeList = async (req: Request, res: Response) => {
    try {
        const isTrash = req.query.is_trash === "true";
        const find: any = {
            deleted: isTrash
        };

        if (req.query.keyword) {
            const keyword = String(req.query.keyword).trim();
            const slugKeyword = convertToSlug(keyword).replace(/-/g, " ");
            const keywordRegex = new RegExp(keyword, "i");
            const slugRegex = new RegExp(slugKeyword, "i");

            find.$or = [
                { name: keywordRegex },
                { search: slugRegex }
            ];
        }

        const limitItems = parseInt(`${req.query.limit}`) || 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecords, deletedCount] = await Promise.all([
            AttributeProduct.find(find)
                .sort({ createdAt: "desc" })
                .limit(limitItems)
                .skip(skip),
            AttributeProduct.countDocuments(find),
            AttributeProduct.countDocuments({ deleted: true })
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
                    limit: limitItems,
                    deletedCount
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
        req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");

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

        req.body.search = convertToSlug(req.body.name).replace(/-/g, " ");

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

        // Kiểm tra xem có sản phẩm nào dùng thuộc tính này không
        const isUsed = await Product.exists({
            attributes: id,
            deleted: false
        });

        if (isUsed) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa thuộc tính này vì đang có sản phẩm sử dụng!"
            });
        }

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

export const restoreAttribute = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await AttributeProduct.updateOne({ _id: id }, { deleted: false });

        return res.json({
            success: true,
            message: "Khôi phục thuộc tính thành công!"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Lỗi khôi phục thuộc tính!"
        });
    }
}

export const forceDeleteAttribute = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await AttributeProduct.deleteOne({ _id: id });

        return res.json({
            success: true,
            message: "Xóa vĩnh viễn thuộc tính thành công!"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Lỗi xóa vĩnh viễn thuộc tính!"
        });
    }
}

export const expiredList = async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const limitItems = 20;
        const skip = (page - 1) * limitItems;

        const [records, totalRecords] = await Promise.all([
            ExpiredProduct.find({})
                .sort({ discardedAt: -1 })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            ExpiredProduct.countDocuments({})
        ]);

        return res.json({
            success: true,
            message: "Lấy danh sách sản phẩm hết hạn thành công",
            data: {
                recordList: records,
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
            message: "Lỗi hệ thống khi lấy danh sách sản phẩm hết hạn"
        });
    }
}

export const scanExpiredProducts = async (req: Request, res: Response) => {
    try {
        const results = await handleProductExpiry();
        return res.json({
            success: true,
            message: `Quét sản phẩm hoàn tất. Đã phát hiện ${results.totalFound ?? 0} sản phẩm hết hạn.`,
            data: results
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi quét sản phẩm hết hạn"
        });
    }
}
