type PetLite = {
    type?: string;
    weight?: number;
    name?: string;
};

type FeedingItem = {
    time: string;
    food: string;
    amount: string;
    note: string;
    status: "pending";
    petType: "dog" | "cat" | "all";
    staffId: null;
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
    staffId: null;
    staffName: string;
    doneAt: null;
};

const normalizePetType = (value: unknown): "dog" | "cat" | null => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "dog") return "dog";
    if (raw === "cat") return "cat";
    return null;
};

const avgWeight = (pets: PetLite[]): number => {
    const list = pets
        .map((item) => Number(item?.weight || 0))
        .filter((weight) => Number.isFinite(weight) && weight > 0);
    if (!list.length) return 0;
    return list.reduce((sum, item) => sum + item, 0) / list.length;
};

const getDogAmountHint = (dogs: PetLite[]): string => {
    const weight = avgWeight(dogs);
    if (!weight) {
        return "Khẩu phần ngày tham khảo: 2-3% trọng lượng cơ thể";
    }
    const minGram = Math.round(weight * 20);
    const maxGram = Math.round(weight * 30);
    return `Khẩu phần ngày tham khảo ${minGram}-${maxGram}g (2-3% trọng lượng)`;
};

const buildDogFeedingTemplate = (dogs: PetLite[]): FeedingItem[] => {
    const weight = avgWeight(dogs);
    const isSmallDog = weight > 0 && weight < 10;
    const amountHint = getDogAmountHint(dogs);
    return [
        {
            time: "06:30",
            food: "Hạt (Royal Canin)",
            amount: "50% khẩu phần ngày",
            note: `${amountHint}. Sau ăn nghỉ 30 phút`,
            status: "pending",
            petType: "dog",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "12:00",
            food: "Snack nhẹ / Bánh thưởng",
            amount: "10-20g",
            note: "Bữa phụ nhẹ nhàng",
            status: "pending",
            petType: "dog",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "17:30",
            food: "Hạt + Pate hoặc Thịt luộc",
            amount: "50% khẩu phần ngày",
            note: "Điều chỉnh theo khẩu vị thú cưng",
            status: "pending",
            petType: "dog",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const buildDogExerciseTemplate = (): ExerciseItem[] => {
    return [
        {
            time: "07:15",
            activity: "Đi dạo nhẹ + đi vệ sinh",
            durationMinutes: 25,
            note: "Mục tiêu: 15-30 phút",
            status: "pending",
            petType: "dog",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "19:00",
            activity: "Vận động chính (chạy/ném bóng/đi dạo)",
            durationMinutes: 30,
            note: "Mục tiêu: 20-40 phút. Tổng vận động/ngày tùy giống: 30-90 phút",
            status: "pending",
            petType: "dog",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const buildCatFeedingTemplate = (cats: PetLite[]): FeedingItem[] => {
    return [
        {
            time: "07:00",
            food: "Hạt (Royal Canin)",
            amount: "30-40g",
            note: "Bữa sáng cho mèo. Thay nước sạch.",
            status: "pending",
            petType: "cat",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "14:00",
            food: "Súp thưởng (Churu)",
            amount: "1 thanh",
            note: "Bổ sung nước và khoáng",
            status: "pending",
            petType: "cat",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "19:00",
            food: "Pate (Gói/Lon)",
            amount: "1 gói",
            note: "Bữa tối dinh dưỡng cao",
            status: "pending",
            petType: "cat",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const buildCatExerciseTemplate = (): ExerciseItem[] => {
    return [
        {
            time: "19:30",
            activity: "Chơi săn mồi giả lập (cần câu/laser/bóng)",
            durationMinutes: 20,
            note: "Mục tiêu 15-30 phút/ngày",
            status: "pending",
            petType: "cat",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const appendHydrationNote = (feeding: FeedingItem[]): FeedingItem[] => {
    return feeding.map((item) => ({
        ...item,
        note: `${item.note}. Luôn có nước sạch 24h, thay nước ít nhất 2 lần/ngày`,
    }));
};

export const buildDefaultBoardingCareSchedule = (pets: PetLite[]) => {
    const safePets = Array.isArray(pets) ? pets : [];
    const dogs = safePets.filter((pet) => normalizePetType(pet?.type) === "dog");
    const cats = safePets.filter((pet) => normalizePetType(pet?.type) === "cat");

    const includeDog = dogs.length > 0 || cats.length === 0;
    const includeCat = cats.length > 0;

    let feedingSchedule: FeedingItem[] = [];
    let exerciseSchedule: ExerciseItem[] = [];

    if (includeDog) {
        feedingSchedule = feedingSchedule.concat(buildDogFeedingTemplate(dogs));
        exerciseSchedule = exerciseSchedule.concat(buildDogExerciseTemplate());
    }

    if (includeCat) {
        feedingSchedule = feedingSchedule.concat(buildCatFeedingTemplate(cats));
        exerciseSchedule = exerciseSchedule.concat(buildCatExerciseTemplate());
    }

    feedingSchedule = appendHydrationNote(feedingSchedule).slice(0, 30);
    exerciseSchedule = exerciseSchedule.slice(0, 30);

    return {
        feedingSchedule,
        exerciseSchedule,
    };
};

