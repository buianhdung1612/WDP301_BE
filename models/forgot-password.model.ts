import mongoose from "mongoose";

const schema = new mongoose.Schema({
    email: String,
    otp: String,
    expireAt: {
        type: Date,
        default: Date.now,
        expires: 180 // 3 phút
    }
}, {
    timestamps: true
});

const ForgotPassword = mongoose.model('ForgotPassword', schema, "forgot-password");

export default ForgotPassword;
