import { reactive, watch } from "vue";

const STORAGE_KEY = "nutribatch:planner";

const newId = () => crypto.randomUUID();

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_KCAL = 2000;

const createDefaultMeals = () => [
    { id: newId(), type: "breakfast", ratio: 25 },
    { id: newId(), type: "lunch", ratio: 35 },
    { id: newId(), type: "dinner", ratio: 30 },
    { id: newId(), type: "snack", ratio: 10 },
];

const createDefaultState = () => ({
    dailyKcal: DEFAULT_KCAL,
    selectedDays: [...DEFAULT_DAYS],
    meals: createDefaultMeals(),
    selectedRecipeIds: [],
});

const sanitizeState = (parsed) => {
    const fallback = createDefaultState();
    if (!parsed || typeof parsed !== "object") return fallback;

    const dailyKcal =
        typeof parsed.dailyKcal === "number" && parsed.dailyKcal > 0
            ? parsed.dailyKcal
            : fallback.dailyKcal;

    const selectedDays = Array.isArray(parsed.selectedDays)
        ? parsed.selectedDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : fallback.selectedDays;

    const meals = Array.isArray(parsed.meals)
        ? parsed.meals
            .filter(
                (m) =>
                    m &&
                    typeof m.id === "string" &&
                    typeof m.type === "string" &&
                    typeof m.ratio === "number",
            )
            .map((m) => ({ id: m.id, type: m.type, ratio: m.ratio }))
        : fallback.meals;

    const selectedRecipeIds = Array.isArray(parsed.selectedRecipeIds)
        ? parsed.selectedRecipeIds.filter((id) => typeof id === "string")
        : [];

    return { dailyKcal, selectedDays, meals, selectedRecipeIds };
};

const loadState = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createDefaultState();
        return sanitizeState(JSON.parse(raw));
    } catch {
        return createDefaultState();
    }
};

export const planner = reactive(loadState());

watch(
    planner,
    (state) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_err) {}
    },
    { deep: true },
);

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "supper"];

export const addMeal = () => planner.meals.push({ id: newId(), type: "snack", ratio: 0 });

export const removeMeal = (id) => planner.meals = planner.meals.filter((m) => m.id !== id);

export const toggleDay = (day) => {
    if (planner.selectedDays.includes(day)) planner.selectedDays = planner.selectedDays.filter((d) => d !== day);
    else planner.selectedDays = [...planner.selectedDays, day].sort((a, b) => a - b);
};

export const resetPlanner = () => {
    const fresh = createDefaultState();
    planner.dailyKcal = fresh.dailyKcal;
    planner.selectedDays = fresh.selectedDays;
    planner.meals = fresh.meals;
    planner.selectedRecipeIds = [];
};
