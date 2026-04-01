
const mongoose = require("mongoose");

async function migrate() {
    try {
        await mongoose.connect("mongodb+srv://buianh09dung:Dd147741%40@cluster0.i3isheh.mongodb.net/wdp301");
        console.log("Connected to DB");

        const db = mongoose.connection.db;
        const petsCollection = db.collection('pets');

        const pets = await petsCollection.find({ deleted: false }).toArray();
        console.log(`Found ${pets.length} active pets.`);

        let updatedCount = 0;
        for (const pet of pets) {
            let newAge = pet.age;
            let updated = false;

            if (pet.age === undefined || pet.age === null) {
                newAge = 12; // Default 1 year in months
                updated = true;
                console.log(`Pet ${pet.name} missing age, setting to 12 months.`);
            } else if (pet.age < 12) {
                // If age is small (like 1, 2, 4), it's likely years.
                // We'll multiply by 12 to convert years to months.
                console.log(`Pet ${pet.name} age ${pet.age} seems like years, converting to ${pet.age * 12} months.`);
                newAge = pet.age * 12;
                updated = true;
            }

            if (updated) {
                await petsCollection.updateOne({ _id: pet._id }, { $set: { age: newAge } });
                updatedCount++;
            }
        }

        console.log(`Migration completed. Updated ${updatedCount} pets.`);
        process.exit(0);
    } catch (e) {
        console.error("Migration error:", e);
        process.exit(1);
    }
}

migrate();
