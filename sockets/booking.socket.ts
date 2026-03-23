import { Socket, Server } from "socket.io";

export const bookingSocket = (io: Server, socket: Socket) => {
    // Chỉ admin mới nhận được các thông báo này 
    // (Logic join room đã có trong auth.socket.ts)

    // Ví dụ: Nhận yêu cầu phân công lại từ Admin
    socket.on("admin-reassign-request", (data) => {
        console.log("Admin requesting reassignment:", data);
        // Logic xử lý nếu cần
    });

    // Các event khác về booking có thể thêm ở đây
};
