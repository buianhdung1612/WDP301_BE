import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import slugify from 'slugify';
import { buildCategoryTree } from '../../helpers/category.helper';
import AttributeProduct from '../../models/attribute-product.model';
import Product from '../../models/product.model';
import { generateRandomString } from '../../helpers/generate.helper';

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

// Sản phẩm
export const list = async (req: Request, res: Response) => {
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

        if (req.query.status) {
            find.status = req.query.status;
        }

        const limitItems = 20;
        const page = Math.max(1, parseInt(`${req.query.page}`) || 1);
        const skip = (page - 1) * limitItems;

        const [recordList, totalRecord] = await Promise.all([
            Product.find(find)
                .sort({ position: "desc" })
                .limit(limitItems)
                .skip(skip)
                .lean(),
            Product.countDocuments(find)
        ]);

        // Get category names
        const categoryIds = recordList.flatMap(item => item.category || []);
        const categories = await CategoryProduct.find({ _id: { $in: categoryIds } }).select("name").lean();
        const categoryMap = categories.reduce((acc: any, cur: any) => {
            acc[cur._id.toString()] = cur.name;
            return acc;
        }, {});

        const recordListWithCategory = recordList.map(item => ({
            ...item,
            categoryInfo: (item.category || []).map((id: any) => ({
                id,
                name: categoryMap[id.toString()] || "N/A"
            }))
        }));

        return res.json({
            success: true,
            message: "Lấy danh sách sản phẩm thành công",
            data: {
                recordList: recordListWithCategory,
                pagination: {
                    totalRecords: totalRecord,
                    totalPages: Math.ceil(totalRecord / limitItems),
                    currentPage: page,
                    limit: limitItems
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
        let slug = req.body.slug;
        if (!slug || slug.trim() === "") {
            slug = slugify(`${req.body.name}`, { lower: true, strict: true });
        }

        let existSlug = await Product.findOne({
            slug: slug,
            deleted: false
        }).lean();

        if (existSlug) {
            // Append a short random string to make it unique if it already exists
            slug = `${slug}-${generateRandomString(5).toLowerCase()}`;
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

        req.body.search = slugify(`${req.body.name}`, {
            replacement: " ",
            lower: true
        });

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

        if (req.body.slug) {
            const existSlug = await Product.findOne({
                _id: { $ne: id },
                slug: req.body.slug,
                deleted: false
            }).lean();

            if (existSlug) {
                return res.status(400).json({
                    code: "error",
                    message: "Đường dẫn đã tồn tại!"
                });
            }
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
            req.body.search = slugify(`${req.body.name}`, {
                replacement: " ",
                lower: true
            });
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

        await Product.updateOne({
            _id: id
        }, {
            deleted: true,
            deletedAt: new Date(),
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

// Thuộc tính
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
