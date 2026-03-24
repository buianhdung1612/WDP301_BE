import mongoose from "mongoose";

const proofMediaSchema = new mongoose.Schema(
    {
        url: String,
        kind: { type: String, enum: ["image", "video"], default: "image" }
    },
    { _id: false }
);

const schema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BoardingBooking",
            required: true
        },
        petId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pet",
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        meal: {
            type: String, // 'Sáng', 'Trưa', 'Tối'
            required: true
        },
        eatingStatus: {
            type: String,
            enum: ["Hết", "Ăn Ít", "Bỏ Ăn"],
            default: "Hết"
        },
        digestionStatus: {
            type: String,
            enum: ["Bình Thường", "Tiêu Chảy", "Táo Bón", "Nôn Mửa"],
            default: "Bình Thường"
        },
        moodStatus: {
            type: String,
            enum: ["Vui Vẻ", "Bình Thường", "Căng Thẳng", "Ủ Rũ", "Sợ Hãi"],
            default: "Vui Vẻ"
        },
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccountAdmin"
        },
        staffName: String,
        note: String,
        proofMedia: [proofMediaSchema],
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: Date
    },
    { timestamps: true }
);

schema.index({ bookingId: 1, petId: 1, date: 1, meal: 1 }, { unique: true });

const BoardingPetDiary = mongoose.model("BoardingPetDiary", schema, "boarding-pet-diaries");

export default BoardingPetDiary;
