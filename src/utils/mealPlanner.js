const NUTRIENT_ALIASES = {
    calories: ["calories", "energy", "kcal"],
    carbohydrates: ["carbohydrates", "carbs", "carbohydrate"],
    proteins: ["proteins", "protein"],
    fats: ["fats", "fat", "lipids"],
};

const IDEAL_PORTION_GRAMS = 300;
const MIN_PORTION_GRAMS = 50;
const MAX_PORTION_GRAMS = 500;

const CARBS_LATENESS_WEIGHT = 0.8;
const KCAL_LATENESS_WEIGHT = 0.001;

const SAME_DAY_REPEAT_PENALTY = 3;
const USAGE_COUNT_PENALTY = 0.5;

export const getNutrientPortion = (recipe, nutrientKey) => {
    const aliases = NUTRIENT_ALIASES[nutrientKey] ?? [nutrientKey];
    const nutrients = recipe?.nutrients ?? [];
    for (const alias of aliases) {
        const found = nutrients.find((n) => n.key === alias);
        if (found) return found.portion;
    }
    return 0;
};

export const getCarbs = (recipe) => getNutrientPortion(recipe, "carbohydrates");
export const getProteins = (recipe) => getNutrientPortion(recipe, "proteins");
export const getFats = (recipe) => getNutrientPortion(recipe, "fats");

const computeRecipeMacros = (recipe, grams) => ({
    carbs: (getCarbs(recipe) * grams) / 100,
    proteins: (getProteins(recipe) * grams) / 100,
    fats: (getFats(recipe) * grams) / 100,
});

const getLateness = (mealIndex, mealCount) =>
    mealCount <= 1 ? 0 : mealIndex / (mealCount - 1);

const timeFitScore = (recipe, lateness) => {
    const carbs = getCarbs(recipe);
    const kcalPer100 = recipe?.portion_calories ?? 0;
    return -(
        carbs * lateness * CARBS_LATENESS_WEIGHT +
        kcalPer100 * lateness * KCAL_LATENESS_WEIGHT
    );
};

const portionFitScore = (recipe, targetKcal) => {
    const kcalPer100 = recipe?.portion_calories ?? 0;
    if (kcalPer100 <= 0) return -10;
    const gramsForTarget = (targetKcal / kcalPer100) * 100;
    const ratio = Math.max(gramsForTarget, 1) / IDEAL_PORTION_GRAMS;
    return -Math.abs(Math.log(ratio)) * 2;
};

export const scalePortion = (recipe, targetKcal) => {
    const kcalPer100 = recipe?.portion_calories ?? 0;
    if (!kcalPer100 || kcalPer100 <= 0) return { grams: 100, kcal: 0, clamped: false };
    const rawGrams = (targetKcal / kcalPer100) * 100;
    const roundedGrams = Math.round(rawGrams / 10) * 10;
    const grams = Math.max(
        MIN_PORTION_GRAMS,
        Math.min(MAX_PORTION_GRAMS, roundedGrams),
    );
    const kcal = (grams / 100) * kcalPer100;
    return { grams, kcal, clamped: grams !== roundedGrams };
};

const buildSlots = (setup) => {
    const { selectedDays, meals } = setup;
    const mealCount = meals.length;

    const slots = [];
    for (const day of selectedDays) {
        meals.forEach((meal, mealIndex) => {
            const ratio = Number(meal.ratio) || 0;
            slots.push({
                day,
                mealIndex,
                mealId: meal.id,
                mealType: meal.type,
                targetKcal: setup.dailyKcal * (ratio / 100),
                lateness: getLateness(mealIndex, mealCount),
                recipes: [],
            });
        });
    }
    return slots;
};

const assignEachRecipeOnce = (pairs, slots, recipesById, selectedRecipes) => {
    const usedRecipeIds = new Set();

    for (const { si, recipeId } of pairs) {
        if (usedRecipeIds.size === selectedRecipes.length) break;
        if (usedRecipeIds.has(recipeId)) continue;
        if (slots[si].recipes.length > 0) continue;

        slots[si].recipes.push(recipesById.get(recipeId));
        usedRecipeIds.add(recipeId);
    }

    return usedRecipeIds;
};

const fillEmptySlots = (slots, selectedRecipes) => {
    const usageCount = new Map();
    for (const slot of slots)
        for (const r of slot.recipes)
            usageCount.set(r.id, (usageCount.get(r.id) ?? 0) + 1);

    for (const slot of slots) {
        if (slot.recipes.length > 0) continue;

        let bestRecipe = null;
        let bestScore = -Infinity;

        for (const recipe of selectedRecipes) {
            const sameDay = slots
                .filter((s) => s.day === slot.day)
                .some((s) => s.recipes.some((r) => r.id === recipe.id));
            const totalUses = usageCount.get(recipe.id) ?? 0;

            const score =
                timeFitScore(recipe, slot.lateness) +
                portionFitScore(recipe, slot.targetKcal) -
                (sameDay ? SAME_DAY_REPEAT_PENALTY : 0) -
                totalUses * USAGE_COUNT_PENALTY;

            if (score > bestScore) {
                bestScore = score;
                bestRecipe = recipe;
            }
        }

        if (bestRecipe) {
            slot.recipes.push(bestRecipe);
            usageCount.set(bestRecipe.id, (usageCount.get(bestRecipe.id) ?? 0) + 1);
        }
    }
};

const assignLeftoverRecipes = (slots, selectedRecipes, usedRecipeIds) => {
    const leftovers = selectedRecipes.filter((r) => !usedRecipeIds.has(r.id));

    for (const recipe of leftovers) {
        let bestSlot = null;
        let bestScore = -Infinity;

        for (const slot of slots) {
            const targetPerRecipe =
                slot.targetKcal / (slot.recipes.length + 1);
            const score =
                timeFitScore(recipe, slot.lateness) +
                portionFitScore(recipe, targetPerRecipe);

            if (score > bestScore) {
                bestScore = score;
                bestSlot = slot;
            }
        }

        if (bestSlot) {
            bestSlot.recipes.push(recipe);
            usedRecipeIds.add(recipe.id);
        }
    }
};

const materializeSlot = (slot) => {
    const n = slot.recipes.length;
    const targetPerRecipe = n > 0 ? slot.targetKcal / n : 0;

    const recipes = slot.recipes.map((recipe) => {
        const { grams, kcal, clamped } = scalePortion(recipe, targetPerRecipe);
        return {
            id: recipe.id,
            name_key: recipe.name_key,
            grams,
            kcal,
            targetKcal: targetPerRecipe,
            clamped,
            macros: computeRecipeMacros(recipe, grams),
        };
    });

    const actualKcal = recipes.reduce((sum, r) => sum + r.kcal, 0);

    return {
        mealIndex: slot.mealIndex,
        mealId: slot.mealId,
        mealType: slot.mealType,
        targetKcal: slot.targetKcal,
        actualKcal,
        recipes,
    };
};

export const generateDietPlan = (selectedRecipes, setup) => {
    if (!Array.isArray(selectedRecipes) || selectedRecipes.length === 0) return [];
    if (!setup?.selectedDays?.length) return [];
    if (!setup?.meals?.length) return [];
    if (!setup.dailyKcal || setup.dailyKcal <= 0) return [];

    const recipesById = new Map(selectedRecipes.map((r) => [r.id, r]));
    const slots = buildSlots(setup);

    const pairs = [];
    for (let si = 0; si < slots.length; si++) {
        const slot = slots[si];
        for (const recipe of selectedRecipes) {
            pairs.push({
                si,
                recipeId: recipe.id,
                score: timeFitScore(recipe, slot.lateness) + portionFitScore(recipe, slot.targetKcal),
            });
        }
    }
    pairs.sort((a, b) => b.score - a.score);

    const usedRecipeIds = assignEachRecipeOnce(
        pairs,
        slots,
        recipesById,
        selectedRecipes,
    );

    fillEmptySlots(slots, selectedRecipes);
    assignLeftoverRecipes(slots, selectedRecipes, usedRecipeIds);

    const plan = [];
    for (const day of setup.selectedDays) {
        const daySlots = slots.filter((s) => s.day === day);
        const meals = daySlots.map(materializeSlot);
        const totalKcal = meals.reduce((sum, m) => sum + m.actualKcal, 0);
        plan.push({
            day,
            meals,
            totalKcal,
            targetKcal: setup.dailyKcal,
        });
    }

    return plan;
};

export const summarizePlanMacros = (plan) => {
    let carbs = 0;
    let proteins = 0;
    let fats = 0;
    let kcal = 0;

    for (const day of plan) {
        for (const meal of day.meals) {
            for (const recipe of meal.recipes) {
                carbs += recipe.macros.carbs;
                proteins += recipe.macros.proteins;
                fats += recipe.macros.fats;
                kcal += recipe.kcal;
            }
        }
    }

    return { carbs, proteins, fats, kcal };
};

export const countRecipeUsage = (plan) => {
    const counts = new Map();
    for (const day of plan)
        for (const meal of day.meals)
            for (const recipe of meal.recipes)
                counts.set(recipe.id, (counts.get(recipe.id) ?? 0) + 1);
    return counts;
};
