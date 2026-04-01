
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.join(__dirname, "../c:/Users/Admin/Desktop/28tech/FPT/WDP_Demo/WDP301/.env") });

const schema = new mongoose.Schema({
    age: Number,
    name: String,
    deleted: Boolean
}, { collection: 'pets' });

const Pet = mongoose.model("Pet", schema);

async function check() {
    try {
        await mongoose.connect("mongodb+srv://buianh09dung:Dd147741%40@cluster0.i3isheh.mongodb.net/wdp301");
        console.log("Connected");

        const pets = await Pet.find({ deleted: false });
        console.log("Total pets:", pets.length);

        const distribution = {};
        pets.forEach(p => {
            const age = p.age === undefined ? "missing" : p.age;
            distribution[age] = (distribution[age] || 0) + 1;
            if (p.age !== undefined && p.age < 5) {
                console.log(`Small age detected: ${p.name}, age: ${p.age}`);
            }
        });

        console.log("Age distribution:", distribution);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
