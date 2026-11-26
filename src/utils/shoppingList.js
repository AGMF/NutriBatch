const PURCHASE_UNITS = {
    rice: { amount: 1000, unit: "g", label: "1 kg" },
    pasta: { amount: 500, unit: "g", label: "500 g" },
    flour: { amount: 1000, unit: "g", label: "1 kg" },
    sugar: { amount: 1000, unit: "g", label: "1 kg" },
    salt: { amount: 1000, unit: "g", label: "1 kg" },
    oil: { amount: 900, unit: "ml", label: "900 ml" },
    milk: { amount: 1000, unit: "ml", label: "1 L" },
    eggs: { amount: 12, unit: "un", label: "dúzia" },
    butter: { amount: 200, unit: "g", label: "200 g" },
    chicken: { amount: 1000, unit: "g", label: "1 kg" },
    beef: { amount: 1000, unit: "g", label: "1 kg" },
    onion: { amount: 1000, unit: "g", label: "1 kg" },
    tomato: { amount: 1000, unit: "g", label: "1 kg" },
    garlic: { amount: 100, unit: "g", label: "100 g" },
};

const DEFAULT_PURCHASE = { amount: 100, unit: "g", label: "100 g" };

const UNIT_TO_GRAMS = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    mg: 0.001,
    oz: 28.35,
    lb: 453.6,
    ml: 1,
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    liter: 1000,
    liters: 1000,
    tsp: 5,
    tbsp: 15,
    cup: 240,
};

const convertToRuleUnit = (qty, fromUnit, ruleUnit) => {
    if (fromUnit === ruleUnit) return qty;
    const from = (fromUnit ?? "g").toLowerCase();

    if (ruleUnit === "un") {
        const grams = qty * (UNIT_TO_GRAMS[from] ?? 1);
        return grams / 50;
    }
    if (from === "un") return qty * 50;

    return qty * (UNIT_TO_GRAMS[from] ?? 1);
};

const resolveScale = (recipe, portions) => {
    const portion = portions[recipe.id];

    if (portion == null) return 1;
    if (!(portion > 0)) return 0;
    if (!(recipe.total_yield_grams > 0)) return 0;

    return portion / recipe.total_yield_grams;
};

const aggregate = (recipes, portions = {}) => {
    const map = new Map();

    for (const recipe of recipes) {
        const scale = resolveScale(recipe, portions);
        if (scale <= 0) continue;

        for (const ri of recipe.recipe_ingredients ?? []) {
            const ing = ri.ingredients;
            if (!ing?.code_key) continue;

            const rawQty = Number(ri.quantity_grams) || 0;
            const qty = rawQty * scale;
            if (qty <= 0) continue;

            const key = ing.code_key;
            const unit = ing.unit ?? "g";

            if (!map.has(key)) {
                map.set(key, {
                    codeKey: key,
                    nameKey: key,
                    unit,
                    totalQuantity: 0,
                });
            }
            map.get(key).totalQuantity += qty;
        }
    }

    return [...map.values()];
};

const roundToPurchase = (item) => {
    const rule = PURCHASE_UNITS[item.codeKey] ?? DEFAULT_PURCHASE;
    const qtyInRuleUnit = convertToRuleUnit(
        item.totalQuantity,
        item.unit,
        rule.unit,
    );
    const purchaseQuantity =
        Math.ceil(qtyInRuleUnit / rule.amount) * rule.amount;

    return {
        ...item,
        purchaseQuantity,
        purchaseUnit: rule.unit,
        purchaseLabel: rule.label,
    };
};

export const buildShoppingList = (recipes, portions) => {
    if (!Array.isArray(recipes) || recipes.length === 0) return [];

    const scopedRecipes =
        portions != null
            ? recipes.filter((r) => portions[r.id] != null)
            : recipes;

    return aggregate(scopedRecipes, portions ?? {})
        .map(roundToPurchase)
        .sort((a, b) => a.nameKey.localeCompare(b.nameKey));
};

export { PURCHASE_UNITS, DEFAULT_PURCHASE };
