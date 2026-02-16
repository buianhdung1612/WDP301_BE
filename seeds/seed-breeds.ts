import mongoose from "mongoose";
import dotenv from "dotenv";
import Breed from "../models/breed.model";

dotenv.config();

const breedsData = [
    // Dogs
    { name: "Poodle", type: "dog", description: "Thông minh, vui vẻ và dễ thương." },
    { name: "Corgi", type: "dog", description: "Chân ngắn, mông to, rất đáng yêu." },
    { name: "Phốc Sóc (Pomeranian)", type: "dog", description: "Nhỏ bé, tinh nghịch và có bộ lông xù." },
    { name: "Golden Retriever", type: "dog", description: "Thân thiện, thông minh và trung thành." },
    { name: "Husky", type: "dog", description: "Hướng ngoại, nghịch ngợm và có cá tính riêng." },
    { name: "Chihuahua", type: "dog", description: "Lanh lợi, dũng cảm trong thân hình nhỏ bé." },
    { name: "Pug", type: "dog", description: "Khuôn mặt nhăn nheo hài hước, tính cách ổn định." },
    { name: "Shiba Inu", type: "dog", description: "Giống chó Nhật nổi tiếng với nụ cười thân thiện." },
    { name: "Alaska", type: "dog", description: "Khỏe mạnh, thích làm việc và có bộ lông dày." },
    { name: "Samoyed", type: "dog", description: "Mệnh danh là 'chó mỉm cười' với bộ lông trắng mướt." },

    // Cats
    { name: "Mèo Anh lông ngắn", type: "cat", description: "Mập mạp, dễ tính và rất quấn chủ." },
    { name: "Mèo Anh lông dài", type: "cat", description: "Vẻ ngoài sang trọng với bộ lông dài mượt." },
    { name: "Mèo Ba Tư", type: "cat", description: "Mũi tịt, lông dài, tính cách điềm tĩnh." },
    { name: "Mèo Scottish Fold", type: "cat", description: "Nổi bật với đôi tai cụp độc đáo." },
    { name: "Mèo Munchkin", type: "cat", description: "Mèo chân ngắn vô cùng dễ thương." },
    { name: "Mèo Ragdoll", type: "cat", description: "Thân hình lớn, mắt xanh và rất hiền lành." },
    { name: "Mèo Sphynx", type: "cat", description: "Mèo không lông với vẻ ngoài lạ lẫm." },
    { name: "Mèo Mướp", type: "cat", description: "Gần gũi, thông minh và nhanh nhẹn." },
    { name: "Mèo Xiêm", type: "cat", description: "Thanh mảnh, đôi mắt xanh và tiếng kêu đặc trưng." },
    { name: "Mèo Bengal", type: "cat", description: "Lông vằn báo sang trọng và tính cách năng động." }
];

const seedBreeds = async () => {
    try {
        await mongoose.connect(`${process.env.DATABASE}`);
        console.log("Connected to DB for seeding breeds...");

        // Remove existing breeds to prevent duplicates if name is unique
        await Breed.deleteMany({});

        await Breed.insertMany(breedsData);

        console.log("Seed breeds successfully!");
        process.exit();
    } catch (error) {
        console.error("Seed failed!", error);
        process.exit(1);
    }
};

seedBreeds();
