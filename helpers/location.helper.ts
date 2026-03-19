import axios from "axios";
import { getApiShipping } from '../configs/setting.config';

const normalizeAddress = async (city: string, district: string, ward: string) => {
    const shippingSettings = await getApiShipping();
    const tokenGoShip = shippingSettings?.tokenGoShip || "";

    // Thông tin tỉnh/thành
    const cityRes = await axios.get("https://sandbox.goship.io/api/v2/cities", {
        headers: {
            Authorization: `Bearer ${tokenGoShip}`
        }
    });
    const cityInfo = cityRes.data.data.find((item: any) => item.name == city);
    if (!cityInfo) throw new Error(`Không tìm thấy tỉnh/thành "${city}" trên hệ thống GoShip`);

    // Thông tin quận/huyện
    const districtRes = await axios.get(`https://sandbox.goship.io/api/v2/cities/${cityInfo.id}/districts`, {
        headers: {
            Authorization: `Bearer ${tokenGoShip}`
        }
    });

    const districtInfo = districtRes.data.data.find((item: any) =>
        item.name.toLowerCase().includes(district.toLowerCase()) ||
        district.toLowerCase().includes(item.name.toLowerCase())
    );
    if (!districtInfo) throw new Error(`Không tìm thấy quận/huyện "${district}" trên hệ thống GoShip`);

    // Thông tin phường/xã
    const wardRes = await axios.get(`https://sandbox.goship.io/api/v2/districts/${districtInfo.id}/wards`, {
        headers: {
            Authorization: `Bearer ${tokenGoShip}`
        }
    });

    const wardInfo = wardRes.data.data.find((item: any) =>
        item.name.toLowerCase().includes(ward.toLowerCase()) ||
        ward.toLowerCase().includes(item.name.toLowerCase())
    );
    if (!wardInfo) throw new Error(`Không tìm thấy phường/xã "${ward}" trên hệ thống GoShip`);

    const dataFinal = {
        city: cityInfo.id,
        district: districtInfo.id,
        ward: wardInfo.id
    };

    return dataFinal;
}

const geocodeCache = new Map<string, any>();

export const getInfoAddress = async (latitude: number, longitude: number) => {
    const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    try {
        const geoRes = await axios.get(`https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${latitude},${longitude}&apikey=${process.env.OPENMAP_KEY}`);

        if (!geoRes.data || !geoRes.data.results || geoRes.data.results.length === 0) {
            throw new Error("Không thể định vị địa chỉ từ tọa độ cung cấp.");
        }

        let city = "";
        let district = "";
        let ward = "";

        const addressArray = geoRes.data.results[0].address_components;

        for (const item of addressArray) {
            const name = item.long_name.toLowerCase();

            if (name.includes("thành phố") || name.includes("tỉnh")) {
                city = item.short_name;
            }

            if (name.includes("quận") || name.includes("huyện") || name.includes("thị xã")) {
                district = item.short_name;
            }

            if (name.includes("phường") || name.includes("xã")) {
                ward = item.short_name;
            }
        }

        const result = await normalizeAddress(city, district, ward);
        geocodeCache.set(cacheKey, result);

        return result;
    } catch (error: any) {
        if (error.response?.status === 429) {
            console.error("LỖI RATE LIMIT OPENMAP:", error.message);
            // Nếu là lỗi 429, có thể trả về thông báo cụ thể
            throw new Error("Hệ thống bản đồ đang bận, vui lòng thử lại sau giây lát.");
        }
        throw error;
    }
}
