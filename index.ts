import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import http from 'http';
import { Server } from 'socket.io';
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { connectDB } from './configs/database.config';
import { startCancellationTask } from './helpers/cancellation.task';
import { startExpiryTask } from './helpers/expiry.task';
import { startNotificationTask } from './helpers/notification-job.helper';
import { initSocket } from './sockets/index.socket';

// Load biến môi trường
dotenv.config();

const app = express()
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Gắn io vào global và khởi tạo socket bên Server
(global as any).io = io;
initSocket(io);

const port: number = 3000

// Kết nối CSDL
connectDB();

// Cho phép gửi data lên dạng json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ],
    credentials: true
}));

// Cấu hình routes
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/client', clientRoutes);

server.listen(port, () => {
    startCancellationTask();
    startExpiryTask();
    startNotificationTask();
    console.log(`Website đang chạy trên cổng ${port}`);
})
