export function buildCategoryTree(categories: any[], parentId: string = "") {
    const tree: any[] = [];

    // Bước 1: Gom nhóm danh mục theo parentId vào một Map
    // Dùng string cho key để tránh lỗi so sánh ObjectId
    const childrenMap = new Map();

    categories.forEach(category => {
        const pId = category.parent ? String(category.parent) : "";
        if (!childrenMap.has(pId)) {
            childrenMap.set(pId, []);
        }
        childrenMap.get(pId).push(category);
    });

    // Bước 2: Hàm đệ quy lấy dữ liệu từ Map
    function getChildren(pId: string) {
        const kids = childrenMap.get(pId);
        if (!kids) return undefined; // Trả về undefined thay vì [] để sạch data

        return kids.map((category: any) => {
            const node = {
                id: category.id || category._id,
                name: category.name,
                avatar: category.avatar,
                slug: category.slug,
                status: category.status,
                children: getChildren(String(category._id))
            };

            // Xóa field children nếu nó là undefined (không có con)
            if (!node.children) delete node.children;

            return node;
        });
    }

    return getChildren(parentId) || [];
}