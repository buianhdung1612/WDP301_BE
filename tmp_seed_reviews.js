const mongoose = require('mongoose');

// Mocking the models since I can't easily import TS files from JS script
const ReviewSchema = new mongoose.Schema({
    userId: String,
    productId: String,
    orderId: String,
    orderItemId: String,
    variant: [String],
    rating: Number,
    comment: String,
    images: [String],
    status: { type: String, default: "pending" }
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
    title: String,
    deleted: { type: Boolean, default: false }
});

const UserSchema = new mongoose.Schema({
    fullName: String,
    status: { type: String, default: 'active' }
});

const Review = mongoose.model('Review', ReviewSchema, 'reviews');
const Product = mongoose.model('Product', ProductSchema, 'products');
const User = mongoose.model('AccountUser', UserSchema, 'accounts-user');

async function seed() {
    try {
        await mongoose.connect('mongodb+srv://buianh09dung:Dd147741%40@cluster0.i3isheh.mongodb.net/wdp301');
        console.log('Connected to MongoDB');

        const products = await Product.find({ deleted: false }).limit(5).lean();
        const users = await User.find({ status: "active" }).limit(3).lean();

        if (products.length === 0 || users.length === 0) {
            console.log("Cần có ít nhất 1 sản phẩm và 1 người dùng để seed reviews");
            process.exit(1);
        }

        const comments = [
            "Sản phẩm rất tốt, shop phục vụ nhiệt tình!",
            "Chất lượng sản phẩm tuyệt vời, sẽ ủng hộ dài dài.",
            "Giao hàng nhanh, đóng gói cẩn thận.",
            "Sản phẩm hơi đắt nhưng chất lượng xứng đáng.",
            "Bé nhà mình rất thích sản phẩm này!",
            "Cảm ơn shop, hàng dùng rất thích.",
            "Màu sắc đẹp, đúng như mô tả.",
            "Dùng một thời gian thấy hiệu quả rõ rệt."
        ];

        const reviewsToCreate = [];

        for (const product of products) {
            for (let i = 0; i < 3; i++) {
                const user = users[Math.floor(Math.random() * users.length)];
                reviewsToCreate.push({
                    userId: user._id.toString(),
                    productId: product._id.toString(),
                    orderId: "SEED_ORDER_ID_" + Math.random().toString(36).substring(7),
                    orderItemId: "SEED_ITEM_ID_" + Math.random().toString(36).substring(7),
                    rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
                    comment: comments[Math.floor(Math.random() * comments.length)],
                    status: i === 0 ? "pending" : "approved",
                    createdAt: new Date(Date.now() - Math.random() * 1000000000)
                });
            }
        }

        await Review.deleteMany({});
        const createdReviews = await Review.insertMany(reviewsToCreate);
        console.log(`Seed ${createdReviews.length} reviews successfully!`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seed();
