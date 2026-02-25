// import mongoose from "mongoose";

// const schema = new mongoose.Schema(
//     {
//         websiteName: String,
//         logo: String,
//         phone: String,
//         email: String,
//         address: String,
//         copyright: String,
//         defaultPassword: {
//             type: String,
//             default: "password123"
//         },
//         facebook: String,
//         instagram: String,
//         youtube: String,
//         serviceColors: [{
//             serviceId: {
//                 type: mongoose.Schema.Types.ObjectId,
//                 ref: 'Service'
//             },
//             color: String
//         }]
//     },
//     {
//         timestamps: true,
//     }
// );

// const Setting = mongoose.model('Setting', schema, "settings");

// export default Setting;
import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        key: String,
        data: {
            type: Object,
            default: {}
        },
        updatedBy: String,
    },
    {
        timestamps: true // Tự động tạo ra 2 trường createdAt và updatedAt
    }
);

const Setting = mongoose.model('Setting', schema, "settings");

export default Setting;
