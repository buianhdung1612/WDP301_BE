type PetLite = {
    type?: string;
    weight?: number;
    name?: string;
    age?: number;
    breed?: string;
};

type FeedingItem = {
    time: string;
    food: string;
    amount: string;
    note: string;
    status: "pending";
    petType: "dog" | "cat" | "all";
    petId?: string | null;
    petName?: string;
    staffId: string | null;
    staffName: string;
    doneAt: null;
};

type ExerciseItem = {
    time: string;
    activity: string;
    durationMinutes: number;
    note: string;
    status: "pending";
    petType: "dog" | "cat" | "all";
    petId?: string | null;
    petName?: string;
    staffId: string | null;
    staffName: string;
    doneAt: null;
};

const normalizePetType = (value: unknown): "dog" | "cat" | null => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "dog" || raw === "cho") return "dog";
    if (raw === "cat" || raw === "meo") return "cat";
    return null;
};

const avgWeight = (pets: PetLite[]): number => {
    const list = pets
        .map((item) => Number(item?.weight || 0))
        .filter((weight) => Number.isFinite(weight) && weight > 0);
    if (!list.length) return 0;
    return list.reduce((sum, item) => sum + item, 0) / list.length;
};

/**
 * Tính toán lượng thức ăn khuyến nghị cho chó.
 * Chó trưởng thành: 2-3% trọng lượng cơ thể.
 * Chó con (< 1 tuổi): 4-6% trọng lượng cơ thể.
 */
const getDogAmountHint = (dogs: PetLite[]): { text: string; totalGrams: number; isYoung: boolean } => {
    const weight = avgWeight(dogs);
    const isYoung = dogs.some(d => d.age && d.age < 1);

    if (!weight) {
        return {
            text: isYoung ? "Khẩu phần (cún con): 4-6% trọng lượng/ngày" : "Khẩu phần: 2-3% trọng lượng/ngày",
            totalGrams: 0,
            isYoung
        };
    }

    const ratio = isYoung ? 0.05 : 0.025; // Trung bình 5% cho chó con, 2.5% cho chó lớn
    const totalGrams = Math.round(weight * 1000 * ratio);
    const text = isYoung
        ? `Khẩu phần cún con: ~${totalGrams}g/ngày (khoảng 1/2 bát ăn)`
        : `Khẩu phần: ~${totalGrams}g/ngày (~2 khẩu phần/ngày)`;

    return { text, totalGrams, isYoung };
};

const buildDogFeedingTemplate = (dogs: PetLite[]): FeedingItem[] => {
    const { text: hintText, totalGrams, isYoung } = getDogAmountHint(dogs);
    const isSenior = dogs.some(d => d.age && d.age > 7);
    const portion = totalGrams > 0 ? `${Math.round(totalGrams / (isYoung ? 3 : 2))}g` : "Tùy chỉ định";

    if (isYoung) {
        // Chó con ăn 3 bữa
        return [
            {
                time: "07:00",
                food: "Hạt chó con ngâm mềm / Sữa Puppy chuyên dụng",
                amount: portion,
                note: `Bữa sáng dinh dưỡng cho cún nhỏ. ${hintText}.`,
                status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
            },
            {
                time: "12:00",
                food: "Pate Puppy + Ức gà xé nhỏ",
                amount: portion,
                note: `Bữa trưa bổ sung Protein và Canxi phát triển khung xương.`,
                status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
            },
            {
                time: "18:00",
                food: "Hạt chó con / Thức ăn mềm dễ nhai",
                amount: portion,
                note: `Bữa tối nhẹ nhàng. Tránh ăn quá no trước khi ngủ.`,
                status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
            },
        ];
    }

    if (isSenior) {
        // Chó già
        return [
            {
                time: "08:00",
                food: "Hạt cho chó lớn tuổi / Cơm trộn thịt heo nạc luộc",
                amount: portion,
                note: "Dễ tiêu hóa, hạn chế áp lực lên hệ tiêu hóa. Bổ sung glucosamine nếu có.",
                status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
            },
            {
                time: "18:00",
                food: "Súp rau củ (Cà rốt, Bí đỏ) + Thịt gà xé",
                amount: portion,
                note: "Bữa tối thanh đạm, giàu chất xơ và vitamin.",
                status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
            },
        ];
    }

    // Chó trưởng thành (Poodle, Corgi, Golden...)
    return [
        {
            time: "07:30",
            food: "Hạt khô cao cấp (Royal Canin/Ganador) + Nước sạch",
            amount: portion,
            note: `Bữa sáng năng lượng. ${hintText}.`,
            status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
        },
        {
            time: "12:00",
            food: "Snack / Xương gặm sạch răng / Pate đổi vị",
            amount: "1-2 miếng",
            note: "Giảm stress, bổ sung khoáng chất giữa ngày.",
            status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
        },
        {
            time: "18:30",
            food: "Hạt trộn thịt bò luộc / Gan (ít) / Trứng luộc",
            amount: portion,
            note: "Bữa tối thịnh soạn kết thúc ngày hoạt động.",
            status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
        },
    ];
};

const buildDogExerciseTemplate = (dogs: PetLite[]): ExerciseItem[] => {
    const weight = avgWeight(dogs);
    const isHeavy = weight >= 20;

    return [
        {
            time: "08:15",
            activity: isHeavy ? "Dắt bộ nhẹ nhàng" : "Chơi ném bóng / Chạy bộ",
            durationMinutes: 20,
            note: "Buổi sáng không khí mát mẻ, dắt đi vệ sinh.",
            status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
        },
        {
            time: "17:00",
            activity: "Hoạt động tự do sân vườn / Tương tác xã hội",
            durationMinutes: 30,
            note: "Dùng đồ chơi kích thích hoặc giao lưu bạn bè (nếu hiền).",
            status: "pending", petType: "dog", staffId: null, staffName: "", doneAt: null,
        },
    ];
};

const buildCatFeedingTemplate = (cats: PetLite[]): FeedingItem[] => {
    const weight = avgWeight(cats);
    const isYoung = cats.some(c => c.age && c.age < 1);
    const isSenior = cats.some(c => c.age && c.age > 7);
    const totalGrams = weight > 0 ? Math.round(weight * 1000 * 0.03) : 0;
    const portion = totalGrams > 0 ? `${Math.round(totalGrams / 3)}g` : "1 bát nhỏ";

    if (isSenior) {
        return [
            {
                time: "08:00",
                food: "Pate mềm / Hạt cho mèo già",
                amount: portion,
                note: "Bữa sáng dễ nhai cho mèo lớn tuổi.",
                status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
            },
            {
                time: "19:00",
                food: "Thịt cá thu/cá hồi bỏ xương xé nhỏ",
                amount: portion,
                note: "Giàu Omega-3, tốt cho lông và khớp.",
                status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
            },
        ];
    }

    return [
        {
            time: "07:00",
            food: isYoung ? "Hạt Kitten dinh dưỡng / Pate sữa" : "Hạt khô Mix Pate",
            amount: portion,
            note: "Bữa sáng đầy đủ dưỡng chất. Luôn có nước sạch.",
            status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
        },
        {
            time: "15:00",
            food: "Súp thưởng Ciao Churu / Thịt gà luộc xé",
            amount: "1-2 thanh/miếng",
            note: "Bổ sung nước và tăng tương tác.",
            status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
        },
        {
            time: "20:00",
            food: "Pate cá ngừ / Thịt lon cao cấp",
            amount: portion,
            note: "Bữa tối thơm ngon, giúp mèo ngủ ngon hơn.",
            status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
        },
    ];
};

const buildCatExerciseTemplate = (): ExerciseItem[] => {
    return [
        {
            time: "19:00",
            activity: "Chơi cần câu mèo / Đuổi laser",
            durationMinutes: 15,
            note: "Mèo hoạt động nhiều về đêm. Kích thích bản năng săn mồi.",
            status: "pending", petType: "cat", staffId: null, staffName: "", doneAt: null,
        },
    ];
};

export const buildDefaultBoardingCareSchedule = (
    pets: PetLite[],
    staff?: { staffId: string; staffName: string },
    customFeeding?: Record<string, string>,
    customExercise?: Record<string, string>
) => {
    const staffIdRaw = staff?.staffId || null;
    const staffName = staff?.staffName || "";
    const safePets = Array.isArray(pets) ? pets : [];
    let feedingSchedule: FeedingItem[] = [];
    let exerciseSchedule: ExerciseItem[] = [];

    safePets.forEach((pet: any) => {
        const type = normalizePetType(pet.type || pet.petType);
        const pId = pet._id ? String(pet._id) : null;
        const pName = pet.name || "";

        if (type === "dog") {
            const dogFeeding = buildDogFeedingTemplate([pet]).map(i => ({ ...i, petId: pId, petName: pName }));
            const dogExercise = buildDogExerciseTemplate([pet]).map(i => ({ ...i, petId: pId, petName: pName }));
            feedingSchedule = feedingSchedule.concat(dogFeeding);
            exerciseSchedule = exerciseSchedule.concat(dogExercise);
        } else if (type === "cat") {
            const catFeeding = buildCatFeedingTemplate([pet]).map(i => ({ ...i, petId: pId, petName: pName }));
            const catExercise = buildCatExerciseTemplate().map(i => ({ ...i, petId: pId, petName: pName }));
            feedingSchedule = feedingSchedule.concat(catFeeding);
            exerciseSchedule = exerciseSchedule.concat(catExercise);
        }
    });

    // Apply custom overrides if provided (per item, matching by time slot)
    if (customFeeding) {
        feedingSchedule = feedingSchedule.map(item => {
            const hour = parseInt(item.time.split(':')[0]);
            let override = "";
            if (hour < 11) override = customFeeding["Sáng"];
            else if (hour < 16) override = customFeeding["Trưa"];
            else override = customFeeding["Tối"];

            if (override) {
                return { ...item, food: override, note: (item.note || "") + " (Yêu cầu thay đổi món ăn)" };
            }
            return item;
        });
    }

    if (customExercise) {
        exerciseSchedule = exerciseSchedule.map(item => {
            const hour = parseInt(item.time.split(':')[0]);
            let override = "";
            if (hour < 12) override = customExercise["slot1"];
            else override = customExercise["slot2"];

            if (override) {
                return { ...item, activity: override, note: (item.note || "") + " (Yêu cầu thay đổi hoạt động)" };
            }
            return item;
        });
    }

    // Gán nhân viên nếu có
    const finalFeeding = feedingSchedule.map(item => ({ ...item, staffId: staffIdRaw, staffName }));
    const finalExercise = exerciseSchedule.map(item => ({ ...item, staffId: staffIdRaw, staffName }));

    return {
        feedingSchedule: finalFeeding,
        exerciseSchedule: finalExercise,
    };
};

