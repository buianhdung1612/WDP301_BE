
import Setting from "../models/setting.model";

export const getApiShipping = async () => {
    const setting = await Setting.findOne({
        key: "apiShipping"
    });
    return setting ? setting.data : null;
}

export const getApiPayment = async () => {
    const setting = await Setting.findOne({
        key: "apiPayment"
    });
    return setting ? setting.data : null;
}

export const getApiLoginSocial = async () => {
    const setting = await Setting.findOne({
        key: "apiLoginSocial"
    });
    return setting ? setting.data : null;
}

export const getApiAppPassword = async () => {
    const setting = await Setting.findOne({
        key: "apiAppPassword"
    });
    return setting ? setting.data : null;
}

export const getGeneral = async () => {
    const setting = await Setting.findOne({
        key: "general"
    });
    return setting ? setting.data : null;
}

export const getPointConfig = async () => {
    const setting = await Setting.findOne({
        key: "point"
    });
    return setting ? setting.data : {
        MONEY_PER_POINT: 10000,
        POINT_TO_MONEY: 100
    };
}
