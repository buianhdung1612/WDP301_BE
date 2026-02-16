import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { connectDB } from './configs/database.config';

// Load biến môi trường
dotenv.config();

const app = express()
const port: number = 3000

// Kết nối CSDL
connectDB();

// Cho phép gửi data lên dạng json
app.use(express.json());
app.use(cookieParser());

// CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://hyperdolichocephalic-aerodynamic-ashlee.ngrok-free.dev'
    ],
    credentials: true
}));

// Cấu hình routes
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/client', clientRoutes);

app.listen(port, () => {
    console.log(`Website đang chạy trên cổng ${port}`);
    console.log(`Updated at ${new Date().toISOString()}`);
})
