import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";
import Order from "../../models/order.model";
import slugify from "slugify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result!.secure_url);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};
