const mongoose = require('mongoose');
const Booking = require('./models/booking.model'); // Adjust path as needed or just use mongo directly.
// Since it's a script, maybe just use standard mongo client or just use the model if I can require it.

async function cleanup() {
    try {
        await mongoose.connect('mongodb://localhost:27017/WDP301');
        console.log('Connected to MongoDB');

        // Find bookings that are 'cancelled' or 'completed' but still have 'in-progress' pet tasks
        const stuckBookings = await Booking.find({
            bookingStatus: { $in: ['cancelled', 'completed'] },
            'petStaffMap.status': 'in-progress'
        });

        console.log(`Found ${stuckBookings.length} stuck bookings.`);

        for (const booking of stuckBookings) {
            console.log(`Cleaning up booking: ${booking.code}`);
            booking.petStaffMap.forEach(m => {
                if (m.status === 'in-progress') {
                    m.status = 'cancelled'; // If booking is cancelled, pet tasks should be cancelled too.
                }
            });
            await booking.save();
        }

        console.log('Cleanup complete.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

cleanup();
