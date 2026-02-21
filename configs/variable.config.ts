export const pathAdmin = "admin";

export const permissionList = [
    { id: "dashboard_view", name: "Xem bảng điều khiển" },

    // Quản lý Sản phẩm
    { id: "product_view", name: "Xem danh sách sản phẩm" },
    { id: "product_create", name: "Tạo mới sản phẩm" },
    { id: "product_edit", name: "Chỉnh sửa sản phẩm" },
    { id: "product_delete", name: "Xóa sản phẩm" },
    { id: "product_category_view", name: "Xem danh mục sản phẩm" },
    { id: "product_category_create", name: "Tạo danh mục sản phẩm" },
    { id: "product_category_edit", name: "Sửa danh mục sản phẩm" },
    { id: "product_category_delete", name: "Xóa danh mục sản phẩm" },
    { id: "brand_view", name: "Xem thương hiệu" },
    { id: "brand_create", name: "Tạo thương hiệu" },
    { id: "brand_edit", name: "Sửa thương hiệu" },
    { id: "brand_delete", name: "Xóa thương hiệu" },
    { id: "product_attribute_view", name: "Xem thuộc tính sản phẩm" },
    { id: "product_attribute_create", name: "Tạo thuộc tính sản phẩm" },
    { id: "product_attribute_edit", name: "Sửa thuộc tính sản phẩm" },
    { id: "product_attribute_delete", name: "Xóa thuộc tính sản phẩm" },

    // Quản lý Dịch vụ
    { id: "service_view", name: "Xem danh sách dịch vụ" },
    { id: "service_create", name: "Tạo mới dịch vụ" },
    { id: "service_edit", name: "Chỉnh sửa dịch vụ" },
    { id: "service_delete", name: "Xóa dịch vụ" },
    { id: "service_category_view", name: "Xem danh mục dịch vụ" },
    { id: "service_category_create", name: "Tạo danh mục dịch vụ" },
    { id: "service_category_edit", name: "Sửa danh mục dịch vụ" },
    { id: "service_category_delete", name: "Xóa danh mục dịch vụ" },
    { id: "breed_view", name: "Quản lý giống thú cưng" },
    { id: "breed_create", name: "Tạo giống thú cưng" },
    { id: "breed_edit", name: "Sửa giống thú cưng" },
    { id: "breed_delete", name: "Xóa giống thú cưng" },

    // Quản lý Bài viết
    { id: "blog_view", name: "Xem danh sách bài viết" },
    { id: "blog_create", name: "Tạo bài viết mới" },
    { id: "blog_edit", name: "Chỉnh sửa bài viết" },
    { id: "blog_delete", name: "Xóa bài viết" },
    { id: "blog_category_view", name: "Xem danh mục bài viết" },
    { id: "blog_category_create", name: "Tạo danh mục bài viết" },
    { id: "blog_category_edit", name: "Sửa danh mục bài viết" },
    { id: "blog_category_delete", name: "Xóa danh mục bài viết" },
    { id: "blog_tag_view", name: "Quản lý thẻ (Tags)" },

    // Đơn hàng & Lịch đặt
    { id: "booking_view", name: "Xem danh sách lịch đặt" },
    { id: "booking_create", name: "Tạo mới lịch đặt (Booking)" },
    { id: "booking_edit", name: "Cập nhật trạng thái lịch đặt" },
    { id: "booking_delete", name: "Xóa lịch đặt" },
    { id: "booking_view_all", name: "Xem tất cả lịch trình Spa" },
    { id: "booking_assign", name: "Điều phối nhân viên" },
    { id: "booking_export", name: "Xuất hóa đơn/Lịch trình" },

    // Quản lý Tài khoản & Phân quyền
    { id: "role_view", name: "Xem danh sách nhóm quyền" },
    { id: "role_create", name: "Tạo nhóm quyền mới" },
    { id: "role_edit", name: "Cập nhật phân quyền" },
    { id: "role_delete", name: "Xóa nhóm quyền" },
    { id: "role_permissions", name: "Truy cập Phân quyền nâng cao" },
    { id: "account_admin_view", name: "Xem tài khoản quản trị" },
    { id: "account_admin_create", name: "Tạo tài khoản quản trị" },
    { id: "account_admin_edit", name: "Sửa tài khoản quản trị" },
    { id: "account_admin_delete", name: "Xóa tài khoản quản trị" },
    { id: "account_user_view", name: "Xem thông tin khách hàng" },
    { id: "account_user_create", name: "Tạo tài khoản khách hàng" },
    { id: "account_user_edit", name: "Sửa thông tin khách hàng" },
    { id: "account_user_delete", name: "Xóa khách hàng" },

    // Nhân sự & Vận hành (HR)
    { id: "hr_view", name: "Xem tổng quan nhân sự" },
    { id: "department_view", name: "Quản lý phòng ban" },
    { id: "department_create", name: "Thêm phòng ban" },
    { id: "department_edit", name: "Sửa phòng ban" },
    { id: "department_delete", name: "Xóa phòng ban" },
    { id: "shift_view", name: "Xem danh sách ca làm" },
    { id: "shift_create", name: "Thiết lập ca làm mới" },
    { id: "shift_edit", name: "Chỉnh sửa ca làm" },
    { id: "shift_delete", name: "Xóa ca làm" },
    { id: "schedule_view", name: "Xem lịch làm việc tuần" },
    { id: "schedule_create", name: "Phân ca làm việc" },
    { id: "schedule_edit", name: "Cập nhật lịch làm việc" },
    { id: "schedule_delete", name: "Xóa lịch làm việc" },
    { id: "attendance_view", name: "Theo dõi chấm công" },
    { id: "attendance_edit", name: "Xác nhận công/lương" },
    { id: "attendance_checkin", name: "Tự chấm công (Check-in/out)" },

    // Hệ thống
    { id: "calendar_view", name: "Xem giao diện Calendar" },
    { id: "coupon_view", name: "Xem mã giảm giá" },
    { id: "coupon_create", name: "Tạo mã giảm giá" },
    { id: "coupon_edit", name: "Sửa mã giảm giá" },
    { id: "coupon_delete", name: "Xóa mã giảm giá" },
    { id: "settings_view", name: "Xem cài đặt hệ thống" },
    { id: "settings_edit", name: "Tùy chỉnh hệ thống" },
    { id: "file_manager", name: "Quản lý thư viện ảnh/file" },
];

export const skillsList = [
    { id: "grooming", name: "Cắt tỉa lông" },
    { id: "bathing", name: "Tắm & Vệ sinh" },
    { id: "spa", name: "Spa thư giãn" },
    { id: "healthcare", name: "Chăm sóc sức khỏe" },
    { id: "boarding", name: "Trông giữ thú cưng" },
    { id: "training", name: "Huấn luyện" },
];
