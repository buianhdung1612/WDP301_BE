import { Request, Response } from "express";
import Department from "../../models/department.model";
import AccountAdmin from "../../models/account-admin.model";

// [GET] /api/v1/admin/hr/departments
export const index = async (req: Request, res: Response) => {
    try {
        const filter: any = {};

        if (req.query.status) {
            filter.status = req.query.status;
        }

        const departments = await Department.find(filter)
            .populate("managerId", "fullName email")
            .sort({ createdAt: -1 });

        res.json({
            code: 200,
            message: "Danh sách phòng ban",
            data: departments
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy danh sách phòng ban"
        });
    }
};

// [GET] /api/v1/admin/hr/departments/:id
export const detail = async (req: Request, res: Response) => {
    try {
        const department = await Department.findById(req.params.id)
            .populate("managerId", "fullName email phone avatar");

        if (!department) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy phòng ban"
            });
        }

        res.json({
            code: 200,
            message: "Chi tiết phòng ban",
            data: department
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi lấy chi tiết phòng ban"
        });
    }
};

// [POST] /api/v1/admin/hr/departments
export const create = async (req: Request, res: Response) => {
    try {
        const { name, description, managerId, status, code } = req.body;

        const department = new Department({
            name,
            code,
            description,
            managerId: managerId || null,
            status: status || "active"
        });

        await department.save();

        res.status(201).json({
            code: 201,
            message: "Tạo phòng ban thành công",
            data: department
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi tạo phòng ban"
        });
    }
};

// [PATCH] /api/v1/admin/hr/departments/:id
export const update = async (req: Request, res: Response) => {
    try {
        const { name, description, managerId, status, code } = req.body;

        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy phòng ban"
            });
        }

        if (name) department.name = name;
        if (code !== undefined) (department as any).code = code;
        if (description !== undefined) department.description = description;
        if (managerId !== undefined) department.managerId = managerId;
        if (status) department.status = status;

        await department.save();

        res.json({
            code: 200,
            message: "Cập nhật phòng ban thành công",
            data: department
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi cập nhật phòng ban"
        });
    }
};

// [DELETE] /api/v1/admin/hr/departments/:id
export const remove = async (req: Request, res: Response) => {
    try {
        const departmentId = req.params.id;

        // Check if any staff is assigned to this department
        const staffCount = await AccountAdmin.countDocuments({ departmentId: departmentId });
        if (staffCount > 0) {
            return res.status(400).json({
                code: 400,
                message: `Không thể xóa phòng ban này vì đang có ${staffCount} nhân viên thuộc phòng ban. Hãy chuyển nhân viên sang phòng ban khác trước.`
            });
        }

        const result = await Department.deleteOne({ _id: departmentId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy phòng ban để xóa"
            });
        }

        res.json({
            code: 200,
            message: "Xóa phòng ban vĩnh viễn thành công"
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: "Lỗi khi xóa phòng ban"
        });
    }
};
