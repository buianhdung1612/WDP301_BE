import { Server } from "socket.io";
import { bookingSocket } from "./booking.socket";
import { authSocket } from "./auth.socket";

export const initSocket = (io: Server) => {
    // Middleware authentication cho socket
    io.use(authSocket);

    io.on('connection', (socket) => {
        console.log('User connected to socket:', socket.id);

        // Tự động join room dựa trên role từ authSocket (đã thực hiện trong authSocket)
        // Nhưng ta có thể log ở đây để confirm
        if (socket.data.account?.role === 'admin') {
            console.log(`- Role: Admin - Acc: ${socket.data.account.email}`);
        } else {
            console.log("- Guest/Unknown connected");
        }

        // Modular sockets
        bookingSocket(io, socket);

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
}
