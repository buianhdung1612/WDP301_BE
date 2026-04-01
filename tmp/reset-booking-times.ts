import mongoose from "mongoose";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { resolve } from "path";

// Load env from WDP301_BE
dotenv.config({ path: resolve(__dirname, "../.env") });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URL!);
        console.log("Connected to MongoDB");

        // Import models after connection
        const BoardingConfig = mongoose.model("BoardingConfig", new mongoose.Schema({}, { strict: false }), "boarding-configs");
        const BoardingBooking = mongoose.model("BoardingBooking", new mongoose.Schema({}, { strict: false }), "boarding-bookings");

        const config: any = await BoardingConfig.findOne();
        if (!config) {
            console.error("No config found!");
            return;
        }

        const [inH, inM] = (config.checkInTime || "14:00").split(":").map(Number);
        const [outH, outM] = (config.checkOutTime || "12:00").split(":").map(Number);
        
        console.log(`Config times: In=${inH}:${inM}, Out=${outH}:${outM}`);

        const bookings: any[] = await BoardingBooking.find({
            deleted: false,
            boardingStatus: { $nin: ["cancelled", "checked-out"] }
        });

        console.log(`Found ${bookings.length} active bookings to update.`);

        for (const booking of bookings) {
            const oldIn = booking.checkInDate;
            const oldOut = booking.checkOutDate;

            const newIn = dayjs(oldIn).startOf("day").set("hour", inH).set("minute", inM).toDate();
            const newOut = dayjs(oldOut).startOf("day").set("hour", outH).set("minute", outM).toDate();

            // Also recalculate nights to be safe
            const diffMs = newOut.getTime() - newIn.getTime();
            const numberOfDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

            await BoardingBooking.updateOne(
                { _id: booking._id },
                { 
                    checkInDate: newIn,
                    checkOutDate: newOut,
                    numberOfDays
                }
            );
        }

        console.log("Update completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

run();
