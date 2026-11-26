export const PAGE_SIZE = 10;

const NEXT_CATEGORY_STATE = {
	ignore: "include",
	include: "exclude",
	exclude: "ignore",
};

export const nextCategoryState = (currentState = "ignore") =>
	NEXT_CATEGORY_STATE[currentState] ?? "ignore";

export const toggleCategoryState = (currentState) =>
	currentState === "include" ? "ignore" : "include";

export const createDurationFormatter = (locale, style = "narrow") => {
	const formatter = new Intl.DurationFormat(locale, { style });
	return (totalMinutes) =>
		formatter.format({
			hours: Math.floor(totalMinutes / 60),
			minutes: totalMinutes % 60,
		});
};

const createListFormatter = (locale, type = "conjunction") => {
	const formatter = new Intl.ListFormat(locale, { style: "long", type });
	return (items) => formatter.format(items);
};

const calculateDifficulty = (steps = [], effortLevels = []) => {
	if (!steps.length || !effortLevels.length) return effortLevels[0];

	const totalTiers = effortLevels.length;
	const effortWeights = Object.fromEntries(
		effortLevels.map((level, index) => [level, index]),
	);

	const { activeMinutes, effortScore, hasMaxEffort } = steps.reduce(
		(acc, step) => {
			const weight = effortWeights[step.effort_type] ?? 0;
			const isMax = weight === totalTiers - 1;
			const duration = step.is_active ? step.duration_minutes || 0 : 0;

			return {
				activeMinutes: acc.activeMinutes + duration,
				effortScore: acc.effortScore + (step.is_active ? weight * duration : 0),
				hasMaxEffort: acc.hasMaxEffort || isMax,
			};
		},
		{ activeMinutes: 0, effortScore: 0, hasMaxEffort: false },
	);

	const totalScore = activeMinutes + effortScore * 0.5 + steps.length * 0.8;
	const rawRatio = Math.min(totalScore / 45, 0.99);
	const calculatedIndex = Math.floor(rawRatio * totalTiers);

	const finalIndex =
		hasMaxEffort && calculatedIndex === 0 && totalTiers > 1
			? 1
			: calculatedIndex;

	return effortLevels[finalIndex];
};

const extractIngredientNutrients = (recipeIngredient) => {
	const qty = Number(recipeIngredient.quantity_grams) || 0;
	const ing = recipeIngredient.ingredients || {};

	return Object.entries(ing)
		.filter(([key, val]) => key.endsWith("_100g") && val !== null)
		.map(([key, val]) => ({
			key: key.replace("_100g", ""),
			amount: (qty / 100) * (Number(val) || 0),
			qty,
		}));
};

const computeNutrients = (recipeIngredients = [], sortFn) => {
	const totalWeight = recipeIngredients.reduce(
		(sum, ri) => sum + (Number(ri.quantity_grams) || 0),
		0,
	);

	const totals = recipeIngredients
		.flatMap(extractIngredientNutrients)
		.reduce((acc, { key, amount }) => {
			acc[key] = (acc[key] || 0) + amount;
			return acc;
		}, {});

	const portionFactor = totalWeight > 0 ? 100 / totalWeight : 0;

	const nutrientsList = Object.entries(totals)
		.filter(([_, total]) => total > 0)
		.map(([key, total]) => ({
			key,
			total,
			portion: total * portionFactor,
		}));

	return {
		totalWeight,
		nutrients: sortFn ? sortFn(nutrientsList) : nutrientsList,
	};
};

export const transformRecipe = (recipe, effortLevels, sortFn) => {
	const preparationSteps = (recipe.preparation_steps || []).toSorted(
		(a, b) => a.step_number - b.step_number,
	);

	const totalDurationMinutes = preparationSteps.reduce(
		(acc, s) => acc + (s.duration_minutes || 0),
		0,
	);

	const { totalWeight, nutrients } = computeNutrients(
		recipe.recipe_ingredients,
		sortFn,
	);

	const caloriesNutrient = nutrients.find((n) => n.key === "calories");
	const portionCalories = caloriesNutrient ? caloriesNutrient.portion : 0;

	return {
		...recipe,
		preparation_steps: preparationSteps,
		total_duration_minutes: totalDurationMinutes,
		portion_calories: portionCalories,
		total_yield_grams: Math.round(
			totalWeight * Number(recipe.yield_factor || 0),
		),
		difficulty_level: calculateDifficulty(preparationSteps, effortLevels),
		nutrients,
	};
};

const getUniqueEquipmentKeys = (steps = []) => [
	...new Set(
		steps
			.map((s) => s.equipment?.code_key)
			.filter(Boolean)
			.flatMap((key) => key.split("-and-")),
	),
];

export const formatRecipeEquipment = (steps, locale, translateFn) => {
	const keys = getUniqueEquipmentKeys(steps);
	if (!keys.length) return "";

	const translated = keys
		.map((key) => translateFn(`equipment:${key}`))
		.toSorted((a, b) => a.localeCompare(b, locale));

	return createListFormatter(locale)(translated);
};

const parseActionKey = (rawActionKey = "") => {
	if (!rawActionKey) return null;
	const [actionAndTargets, modifierKey] = rawActionKey.split("@");
	const [action, rawTarget] = actionAndTargets.split("__");
	const targetKeys = rawTarget ? rawTarget.split("-and-") : [];

	return { action, modifierKey, targetKeys };
};

export const formatPreparationStep = (rawActionKey, locale, translate) => {
	const parsed = parseActionKey(rawActionKey);
	if (!parsed) return "";

	const { action, modifierKey, targetKeys } = parsed;

	const modifierText = modifierKey
		? ` ${translate(`modifiers:${modifierKey}`, { defaultValue: modifierKey })}`
		: "";

	const translatedTargets = targetKeys.map((key) =>
		translate(`ingredients:${key}`, { context: "article", defaultValue: key }),
	);

	const formattedTargets = translatedTargets.length
		? createListFormatter(locale)(translatedTargets)
		: "";

	return translate(`actions:${action}`, {
		target: formattedTargets,
		modifier: modifierText,
		defaultValue: `${action} ${formattedTargets}${modifierText}`.trim(),
	});
};

export const updateKey = (map, key, transform) => ({
	...map,
	[key]: transform(map[key]),
});

export const getCategoryIdsByState = (categoryStates = {}, targetState) =>
	Object.entries(categoryStates)
		.filter(([_, state]) => state === targetState)
		.map(([id]) => id);

export const calculateRange = (page, pageSize) => ({
	from: page * pageSize,
	to: (page + 1) * pageSize - 1,
});

export const BASE_SELECT_FIELDS = `
    id,
    name_key,
    description_key,
    yield_factor,
    created_at,
    recipe_categories(category_id, categories(id, code_key)),
    preparation_steps(step_number, action_key, equipment(id, code_key), effort_type, duration_minutes, is_active),
    recipe_ingredients(quantity_grams, ingredients(*))
`.trim();

const buildSelectClause = (includedIds = []) =>
	includedIds.reduce(
		(acc, _, index) =>
			`${acc}, rc_${index}:recipe_categories!inner(category_id)`,
		BASE_SELECT_FIELDS,
	);

export const fetchExcludedRecipeIds = async (
	client,
	excludedCategoryIds = [],
) => {
	if (!excludedCategoryIds.length) return [];

	const { data, error } = await client
		.from("recipe_categories")
		.select("recipe_id")
		.in("category_id", excludedCategoryIds);

	if (error) throw error;
	return [...new Set((data || []).map((row) => row.recipe_id))];
};

export const buildRecipesQuery = (
	client,
	{ includedIds = [], excludedRecipeIds = [], from, to },
) => {
	const selectClause = buildSelectClause(includedIds);
	const baseQuery = client
		.from("recipes")
		.select(selectClause, { count: "exact" });

	const queryWithIncludes = includedIds.reduce(
		(query, id, index) => query.eq(`rc_${index}.category_id`, id),
		baseQuery,
	);

	const queryWithExcludes =
		excludedRecipeIds.length > 0
			? queryWithIncludes.not("id", "in", `(${excludedRecipeIds.join(",")})`)
			: queryWithIncludes;

	return queryWithExcludes
		.range(from, to)
		.order("created_at", { ascending: false });
};
