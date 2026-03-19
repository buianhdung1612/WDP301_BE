import cron from 'node-cron';
import { handleProductExpiry } from './expiry.helper';

export const startExpiryTask = () => {
    // Chạy mỗi 4 tiếng (vào phút 0 của các giờ 0, 4, 8, 12, 16, 20)
    // Hoặc có thể chạy mỗi giờ tùy nhu cầu: '0 * * * *'
    cron.schedule('0 */4 * * *', async () => {
        try {
            await handleProductExpiry();
        } catch (error) {
            console.error("[EXPIRY-TASK] Error during cron run:", error);
        }
    });

    console.log("[EXPIRY-TASK] Product Expiry Task scheduled (Every 4 hours)");
};
