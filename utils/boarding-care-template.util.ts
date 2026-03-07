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
        return "Khau phan ngay tham khao: 2-3% trong luong co the";
    }
    const minGram = Math.round(weight * 20);
    const maxGram = Math.round(weight * 30);
    return `Khau phan ngay tham khao ${minGram}-${maxGram}g (2-3% trong luong)`;
};

const buildDogFeedingTemplate = (dogs: PetLite[]): FeedingItem[] => {
    const amountHint = getDogAmountHint(dogs);
    return [
        {
            time: "06:30",
            food: "Hat hoac pate",
            amount: "40-50% khau phan ngay",
            note: `${amountHint}. Sau an nghi 20-30 phut`,
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "12:00",
            food: "Bua phu (snack/trai cay an toan)",
            amount: "Nho",
            note: "Khong bat buoc voi cho truong thanh",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "17:30",
            food: "Hat + thit luoc hoac pate",
            amount: "50-60% khau phan ngay",
            note: "Co the bo sung giong/khau vi theo huong dan chu nuoi",
            status: "pending",
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
            activity: "Di dao nhe + di ve sinh",
            durationMinutes: 25,
            note: "Muc tieu: 15-30 phut",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "19:00",
            activity: "Van dong chinh (chay/nem bong/di dao)",
            durationMinutes: 30,
            note: "Muc tieu: 20-40 phut. Tong ngay tuy giong 30-90 phut",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const buildCatFeedingTemplate = (): FeedingItem[] => {
    return [
        {
            time: "06:30",
            food: "Hat hoac pate",
            amount: "Khoang 30% khau phan ngay",
            note: "Meo an it nhung nhieu bua",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "12:30",
            food: "Bua phu hat/pate",
            amount: "Khoang 20% khau phan ngay",
            note: "Theo doi kha nang an het khau phan",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "17:30",
            food: "Bua chinh",
            amount: "Khoang 40-50% khau phan ngay",
            note: "Meo truong thanh tham khao 40-60g hat/ngay hoac 2-3 goi pate",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
        {
            time: "21:00",
            food: "Snack nhe",
            amount: "Nho",
            note: "Co the bo sung it hat/snack meo",
            status: "pending",
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
            activity: "Choi san moi gia lap (can cau/laser/bong)",
            durationMinutes: 20,
            note: "Muc tieu 15-30 phut/ngay",
            status: "pending",
            staffId: null,
            staffName: "",
            doneAt: null,
        },
    ];
};

const appendHydrationNote = (feeding: FeedingItem[]): FeedingItem[] => {
    return feeding.map((item) => ({
        ...item,
        note: `${item.note}. Nuoc sach 24h, thay nuoc it nhat 2 lan/ngay`,
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
        feedingSchedule = feedingSchedule.concat(buildCatFeedingTemplate());
        exerciseSchedule = exerciseSchedule.concat(buildCatExerciseTemplate());
    }

    feedingSchedule = appendHydrationNote(feedingSchedule).slice(0, 30);
    exerciseSchedule = exerciseSchedule.slice(0, 30);

    return {
        feedingSchedule,
        exerciseSchedule,
    };
};

