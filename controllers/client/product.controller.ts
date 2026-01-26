import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import CategoryProduct from '../../models/category-product.model';

// [GET] /api/v1/product
export const index = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false,
            status: "active"
        };

        if (req.query.categorySlug) {
            const categoryRecord = await CategoryProduct.findOne({
                slug: req.query.categorySlug as string,
                deleted: false,
                status: "active"
            }).lean();
            if (categoryRecord) {
                find.category = categoryRecord._id.toString();
            }
        }

        const products = await Product.find(find)
            .sort({ position: "desc" })
            .lean();

        return res.json({
            success: true,
            message: "Lấy danh sách sản phẩm thành công",
            data: products
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách sản phẩm"
        });
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
