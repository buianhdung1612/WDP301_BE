import { Request, Response } from 'express';
import Blog from '../../models/blog.model';
import CategoryBlog from '../../models/category-blog.model';

export const list = async (req: Request, res: Response) => {
    try {
        const find: any = {
            deleted: false,
            status: 'published'
        };

        if (req.query.categoryId) {
            find.category = req.query.categoryId;
        }

        // Search
        if (req.query.keyword) {
            const keywordRegex = new RegExp(`${req.query.keyword}`, "i");
            find.name = keywordRegex;
        }

        const blogs = await Blog.find(find)
            .sort({ publishAt: -1, createdAt: -1 })
            .populate('category', 'name')
            .lean();

        // Map model fields to what the frontend expects if necessary
        // Frontend uses: featuredImage (model: avatar), expert/excerpt (model: description)
        const formattedBlogs = blogs.map((blog: any) => ({
            ...blog,
            featuredImage: blog.avatar,
            expert: blog.description,
            excerpt: blog.description
        }));

        return res.status(200).json({
            success: true,
            data: formattedBlogs
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};

export const detail = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const blog = await Blog.findOne({
            slug,
            deleted: false,
            status: 'published'
        }).populate('category', 'name').lean();

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại"
            });
        }

        const formattedBlog = {
            ...blog,
            featuredImage: blog.avatar,
            expert: blog.description,
            excerpt: blog.description
        };

        return res.status(200).json({
            success: true,
            data: formattedBlog
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};
