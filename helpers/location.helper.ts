import axios from "axios";
import { getApiShipping } from '../configs/setting.config';

const normalizeAddress = async (city: string, district: string, ward: string) => {
    try {
        const shippingSettings = await getApiShipping();
        const tokenGoShip = shippingSettings?.tokenGoShip || "";

        if (!tokenGoShip) {
            console.warn("[LOCATION HELPER] No GoShip Token found");
            return null;
        }

        // Tỉnh/thành
        const cityRes = await axios.get("https://sandbox.goship.io/api/v2/cities", {
            headers: { Authorization: `Bearer ${tokenGoShip}` }
        });
        const cityInfo = cityRes.data.data.find((item: any) =>
            item.name.toLowerCase().includes(city.toLowerCase()) ||
            city.toLowerCase().includes(item.name.toLowerCase())
        );
        if (!cityInfo) {
            console.warn(`[LOCATION HELPER] City not found on GoShip: ${city}`);
            return null;
        }

        // Quận/huyện
        const districtRes = await axios.get(`https://sandbox.goship.io/api/v2/cities/${cityInfo.id}/districts`, {
            headers: { Authorization: `Bearer ${tokenGoShip}` }
        });
        const districtInfo = districtRes.data.data.find((item: any) =>
            item.name.toLowerCase().includes(district.toLowerCase()) ||
            district.toLowerCase().includes(item.name.toLowerCase())
        );
        if (!districtInfo) {
            console.warn(`[LOCATION HELPER] District not found on GoShip: ${district}`);
            return null;
        }

        // Phường/xã
        const wardRes = await axios.get(`https://sandbox.goship.io/api/v2/districts/${districtInfo.id}/wards`, {
            headers: { Authorization: `Bearer ${tokenGoShip}` }
        });
        const wardInfo = wardRes.data.data.find((item: any) =>
            item.name.toLowerCase().includes(ward.toLowerCase()) ||
            ward.toLowerCase().includes(item.name.toLowerCase())
        );
        if (!wardInfo) {
            console.warn(`[LOCATION HELPER] Ward not found on GoShip: ${ward}`);
            return null;
        }

        return {
            city: cityInfo.id,
            district: districtInfo.id,
            ward: wardInfo.id
        };
    } catch (error: any) {
        console.error("[LOCATION HELPER] GoShip Normalization Error:", error.message);
        return null;
    }
}

const geocodeCache = new Map<string, any>();

export const getInfoAddress = async (latitude: number, longitude: number) => {
    const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    try {
        const shippingSettings = await getApiShipping();
        const goongApiKey = shippingSettings?.goongApiKey || "";

        let city = "";
        let district = "";
        let ward = "";

        // Ưu tiên dùng Goong vì sự ổn định
        if (goongApiKey) {
            try {
                const goongRes = await axios.get(`https://restapi.goong.io/Geocode?latlng=${latitude},${longitude}&api_key=${goongApiKey}`);
                if (goongRes.data.results && goongRes.data.results.length > 0) {
                    const components = goongRes.data.results[0].address_components;
                    for (const item of components) {
                        const types = item.types || [];
                        if (types.includes("administrative_area_level_1")) city = item.long_name;
                        if (types.includes("administrative_area_level_2")) district = item.long_name;
                        if (types.includes("sublocality_level_1") || types.includes("ward")) ward = item.long_name;
                    }
                }
            } catch (err: any) {
                console.error("[LOCATION HELPER] Goong Geocode Error:", err.message);
            }
        }

        // Fallback sang OpenMap HOẶC nếu Goong rỗng
        if (!city || !district) {
            try {
                const geoRes = await axios.get(`https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${latitude},${longitude}&apikey=${process.env.OPENMAP_KEY}`);
                if (geoRes.data?.results?.[0]) {
                    const addressArray = geoRes.data.results[0].address_components;
                    for (const item of addressArray) {
                        const name = item.long_name.toLowerCase();
                        if (name.includes("thành phố") || name.includes("tỉnh")) city = item.short_name;
                        if (name.includes("quận") || name.includes("huyện") || name.includes("thị xã")) district = item.short_name;
                        if (name.includes("phường") || name.includes("xã")) ward = item.short_name;
                    }
                }
            } catch (err: any) {
                console.warn("[LOCATION HELPER] OpenMap Fallback Error:", err.message);
            }
        }

        if (!city || !district) {
            console.warn("[LOCATION HELPER] Could not determine address components");
            return null;
        }

        const result = await normalizeAddress(city, district, ward);
        if (result) {
            geocodeCache.set(cacheKey, result);
        }

        return result;
    } catch (error: any) {
        console.error("[LOCATION HELPER] Critical Error in getInfoAddress:", error.message);
        return null;
    }
}
