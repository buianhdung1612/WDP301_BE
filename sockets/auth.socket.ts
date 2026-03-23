import { Socket } from "socket.io";
import * as cookie from 'cookie';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const authSocket = (socket: Socket, next: any) => {
    try {
        const cookieString = socket.handshake.headers.cookie;
        if (cookieString) {
            const cookieParsed = cookie.parse(cookieString);

            let token: string = "";

            if (cookieParsed.tokenAdmin) {
                token = cookieParsed.tokenAdmin;

                if (token) {
                    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;

                    if (decoded && decoded.id && decoded.email) {
                        socket.data.account = {
                            id: decoded.id,
                            email: decoded.email,
                            role: "admin"
                        };

                        // Join 'admin' room automatically
                        socket.join('admin');
                        console.log(`Admin ${decoded.email} connected and joined room: admin`);
                    }
                }
            }
        }
        next();
    } catch (error) {
        console.log("Socket Auth Error:", error);
        next(); // Vẫn cho kết nối nhưng không có data.account nếu lỗi
    }
}
