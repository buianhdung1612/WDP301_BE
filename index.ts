import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import http from 'http';
import session from 'express-session';
import passport from 'passport';
import dns from 'dns';

// Fix lỗi DNS ECONNREFUSED cho MongoDB Atlas trên một số nhà mạng/máy tính
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import { Server } from 'socket.io';
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { connectDB } from './configs/database.config';
import { startCancellationTask } from './jobs/cancellation.job';
import { startExpiryTask } from './jobs/expiry.job';
import { startNotificationTask } from './jobs/notification.job';
import { startBookingTask } from './jobs/booking.job';
import { initSocket } from './sockets/index.socket';
import { configGooglePassport } from './configs/googleOauth.config';
import { configureFacebookPassport } from './configs/facebookOauth.config';

// Load biến môi trường
dotenv.config();

const app = express()
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: true, // Cho phép tất cả các nguồn trong quá trình dev cho nhanh
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Gắn io vào global và khởi tạo socket bên Server
(global as any).io = io;
initSocket(io);

const port: number = 3000

// Kết nối CSDL và khởi tạo các dịch vụ
const startServer = async () => {
    try {
        await connectDB();

        // Khởi tạo OAuth passport sau khi đã có kết nối DB
        await configGooglePassport(passport);
        await configureFacebookPassport(passport);

        server.listen(port, () => {
            startCancellationTask();
            startExpiryTask();
            startNotificationTask();
            startBookingTask();
            console.log(`Website đang chạy trên cổng ${port}`);
        });
    } catch (error) {
        console.error("Lỗi khi khởi động server:", error);
    }
};

// Cho phép gửi data lên dạng json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use(cors({
    origin: true, // Cho phép tất cả các nguồn cho mobile dev
    credentials: true
}));

// Cấu hình session
app.use(session({
    secret: `${process.env.SESSION_SECRET || 'teddy_pet_secret'}`,
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

// Cấu hình routes
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/client', clientRoutes);

startServer();
