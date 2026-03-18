import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        },
        name: String,
        quantity: Number, // Số lượng tồn kho tại thời điểm hết hạn
        expiryDate: Date,
        discardedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
    }
);

const ExpiredProduct = mongoose.model("ExpiredProduct", schema, "expired-products");

export default ExpiredProduct;
