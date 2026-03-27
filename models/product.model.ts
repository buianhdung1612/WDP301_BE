import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        name: String,
        sku: String,
        slug: String,
        position: Number,
        brandId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Brand"
        },
        category: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "CategoryProduct"
        }],
        images: [String],
        priceOld: Number,
        priceNew: Number,
        discount: {
            type: Number,
            default: 0
        },
        stock: Number,
        attributes: Array,
        variants: Array,
        description: String,
        content: String,
        status: {
            type: String,
            enum: ["draft", "active", "inactive"],
            default: "draft"
        },
        view: {
            type: Number,
            default: 0
        },
        search: String,
        isFood: {
            type: Boolean,
            default: false
        },
        expiryDate: Date,
        suitableBreeds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Breed"
        }],
        minAge: {
            type: Number, // In months
            default: 0
        },
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    {
        timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
    }
);

const Product = mongoose.model('Product', schema, "products");

export default Product;
