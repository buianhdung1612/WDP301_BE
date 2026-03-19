import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import CategoryProduct from '../../models/category-product.model';
import Brand from '../../models/brand.model';

// [GET] /api/v1/product
export const index = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false,
            status: "active"
        };

        // 1. Lọc theo danh mục
        if (req.query.categorySlug) {
            const categoryRecord = await CategoryProduct.findOne({
                slug: req.query.categorySlug as string,
                deleted: false,
                status: "active"
            }).lean();
            if (categoryRecord) {
                find.category = { $in: [categoryRecord._id] };
            }
        } else if (req.query.category) {
            const categoryIds = Array.isArray(req.query.category)
                ? req.query.category
                : [req.query.category];
            find.category = { $in: categoryIds };
        }

        // 2. Lọc theo thương hiệu
        if (req.query.brandSlug) {
            const brandRecord = await Brand.findOne({
                slug: req.query.brandSlug as string,
                deleted: false,
                status: "active"
            }).lean();
            if (brandRecord) {
                find.brandId = brandRecord._id;
            }
        }

        // 3. Tìm kiếm theo từ khóa
        if (req.query.keyword) {
            const keyword = req.query.keyword as string;
            // Tìm kiếm text đơn giản hoặc dùng regex
            const regex = new RegExp(keyword, "i");
            find.$or = [
                { name: regex },
                { sku: regex }
            ];
        }

        // 3. Lọc theo khoảng giá
        const minPrice = parseInt(req.query.minPrice as string);
        const maxPrice = parseInt(req.query.maxPrice as string);
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            find.priceNew = {};
            if (!isNaN(minPrice)) find.priceNew.$gte = minPrice;
            if (!isNaN(maxPrice)) find.priceNew.$lte = maxPrice;
        }

        // 4. Sắp xếp
        let sort: any = { position: "desc" };
        if (req.query.sortKey && req.query.sortValue) {
            sort = { [req.query.sortKey as string]: req.query.sortValue };
        }

        // 5. Phân trang
        const limit = parseInt(req.query.limit as string) || 9;
        const page = parseInt(req.query.page as string) || 1;
        const skip = (page - 1) * limit;

        const [products, totalItems] = await Promise.all([
            Product.find(find)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(find)
        ]);

        return res.json({
            success: true,
            message: "Lấy danh sách sản phẩm thành công",
            data: {
                products,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách sản phẩm"
        });
    }
}

// [GET] /api/v1/product/categories
export const categories = async (req: Request, res: Response) => {
    try {
        const categories = await CategoryProduct.find({
            deleted: false,
            status: "active"
        }).sort({ position: "desc" }).lean();

        // Đếm số sản phẩm trong mỗi danh mục (tùy chọn)
        const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
            const count = await Product.countDocuments({
                category: cat._id,
                deleted: false,
                status: "active"
            });
            return { ...cat, productCount: count };
        }));

        res.json({
            success: true,
            data: categoriesWithCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh mục" });
    }
}

// [GET] /api/v1/product/brands
export const brands = async (req: Request, res: Response) => {
    try {
        const brands = await Brand.find({
            deleted: false,
            status: "active"
        }).sort({ position: "desc" }).lean();

        // Đếm số sản phẩm trong mỗi thương hiệu
        const brandsWithCount = await Promise.all(brands.map(async (brand) => {
            const count = await Product.countDocuments({
                brandId: brand._id,
                deleted: false,
                status: "active"
            });
            return { ...brand, productCount: count };
        }));

        res.json({
            success: true,
            data: brandsWithCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy thương hiệu" });
    }
}

// [GET] /api/v1/product/search/suggestions
export const suggestions = async (req: Request, res: Response) => {
    try {
        const keyword = req.query.keyword as string;
        if (!keyword) return res.json({ success: true, data: [] });

        const regex = new RegExp(keyword, "i");
        const products = await Product.find({
            name: regex,
            deleted: false,
            status: "active"
        })
            .limit(5)
            .select("name slug images priceNew priceOld")
            .lean();

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi tìm kiếm gợi ý" });
    }
}

// [GET] /api/v1/product/detail/:slug
export const detail = async (req: Request, res: Response) => {
    try {
        const productDetail: any = await Product.findOne({
            slug: req.params.slug,
            deleted: false,
            status: "active"
        }).lean();

        if (!productDetail) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        const [attributeListRaw, categoryList] = await Promise.all([
            AttributeProduct.find({
                _id: { $in: productDetail.attributes || [] }
            }).lean(),
            CategoryProduct.find({
                _id: { $in: productDetail.category || [] },
                deleted: false,
                status: "active"
            }).select("name slug").lean()
        ]);

        const attributeList = attributeListRaw.map((attribute: any) => {
            const variantValues = new Set<string>();
            const variantLabels = new Set<string>();

            const attrIdStr = attribute._id.toString();

            (productDetail.variants || [])
                .filter((variant: any) => variant.status)
                .forEach((variant: any) => {
                    (variant.attributeValue || []).forEach((attr: any) => {
                        if (attr.attrId === attrIdStr) {
                            variantValues.add(attr.value);
                            variantLabels.add(attr.label);
                        }
                    });
                });

            return {
                ...attribute,
                variants: Array.from(variantValues),
                variantsLabel: Array.from(variantLabels)
            };
        });

        return res.json({
            success: true,
            message: "Lấy chi tiết sản phẩm thành công",
            data: {
                productDetail: {
                    ...productDetail,
                    categoryList: categoryList
                },
                attributeList
            }
        });

    } catch (error) {
        console.error("Error in product detail controller:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy chi tiết sản phẩm"
        });
    }
}
