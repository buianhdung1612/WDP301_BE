import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        type: {
            type: String,
            enum: ["dog", "cat"],
            required: true
        },
        description: String,
    },
    {
        timestamps: true,
    }
);

const Breed = mongoose.model("Breed", schema, "breeds");

export default Breed;
