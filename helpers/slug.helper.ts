import slugify from "slugify";

export const convertToSlug = (text: string): string => {
    return slugify(text, {
        replacement: '-',
        remove: undefined,
        lower: true,
        strict: true,
        locale: 'vi',
        trim: true
    });
};
