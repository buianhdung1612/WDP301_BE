
const mongoose = require("mongoose");

async function check() {
    try {
        await mongoose.connect("mongodb+srv://buianh09dung:Dd147741%40@cluster0.i3isheh.mongodb.net/wdp301");
        console.log("Connected");

        // Use connection.db directly to avoid model compilation issues
        const db = mongoose.connection.db;
        const pets = await db.collection('pets').find({ deleted: false }).toArray();
        console.log("Total pets:", pets.length);

        const distribution = {};
        pets.forEach(p => {
            const age = p.age === undefined ? "missing" : p.age;
            distribution[age] = (distribution[age] || 0) + 1;
            if (p.age !== undefined && p.age < 5) {
                console.log(`Small age detected: ${p.name}, age: ${p.age}`);
            }
        });

        console.log("Age distribution:", JSON.stringify(distribution));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
