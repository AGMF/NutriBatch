import { createClient } from "supabase";
import {
	computed,
	createApp,
	onMounted,
	onUnmounted,
	ref,
	shallowRef,
	useTemplateRef,
	watch,
} from "vue";
import {
	getSupportedLocales,
	i18next,
	i18nextVue,
	initI18n,
	sortTranslated,
	useTranslation,
} from "./i18n.js";

const SUPABASE_URL = "https://ecwvgqzzmxnngfhjlejk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_1uOWx-SNjBrH1ZZSexaLUA_INC5yBQc";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PAGE_SIZE = 10;

const NEXT_CATEGORY_STATE = {
	ignore: "include",
	include: "exclude",
	exclude: "ignore",
};

const nextCategoryState = (currentState = "ignore") =>
	NEXT_CATEGORY_STATE[currentState] ?? "ignore";

const toggleCategoryState = (currentState) =>
	currentState === "include" ? "ignore" : "include";

const createDurationFormatter = (locale, style = "narrow") => {
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

const transformRecipe = (recipe, effortLevels, sortFn) => {
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

const formatRecipeEquipment = (steps, locale, translateFn) => {
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

const formatPreparationStep = (rawActionKey, locale, translate) => {
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

const updateKey = (map, key, transform) => ({
	...map,
	[key]: transform(map[key]),
});

const getCategoryIdsByState = (categoryStates = {}, targetState) =>
	Object.entries(categoryStates)
		.filter(([_, state]) => state === targetState)
		.map(([id]) => id);

const calculateRange = (page, pageSize) => ({
	from: page * pageSize,
	to: (page + 1) * pageSize - 1,
});

const BASE_SELECT_FIELDS = `
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

const fetchExcludedRecipeIds = async (client, excludedCategoryIds = []) => {
	if (!excludedCategoryIds.length) return [];

	const { data, error } = await client
		.from("recipe_categories")
		.select("recipe_id")
		.in("category_id", excludedCategoryIds);

	if (error) throw error;
	return [...new Set((data || []).map((row) => row.recipe_id))];
};

const buildRecipesQuery = (
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

(async () => {
	await initI18n();

	const app = createApp({
		setup() {
			const { i18next: i18n } = useTranslation();
			const currentLocale = ref(i18n.resolvedLanguage);

			const applyGlobalSorting = () => {
				const categorySortKey = (c) => `categories:${c.code_key}`;
				const ingredientSortKey = (ri) =>
					`ingredients:${ri.ingredients?.code_key}`;
				const nutrientSortKey = (n) => `ui:nutrition.nutrients.${n.key}`;

				if (categories.value.length > 0)
					categories.value = sortTranslated(categories.value, categorySortKey);

				if (items.value.length > 0) {
					items.value = items.value.map((recipe) => ({
						...recipe,
						recipe_ingredients: sortTranslated(
							recipe.recipe_ingredients,
							ingredientSortKey,
						),
						nutrients: sortTranslated(recipe.nutrients, nutrientSortKey),
					}));
				}
			};

			const setLocale = async (locale) => {
				await i18n.changeLanguage(locale);
				currentLocale.value = i18n.resolvedLanguage;
				applyGlobalSorting();
			};

			const durationFormatter = computed(() =>
				createDurationFormatter(currentLocale.value),
			);

			const formatDuration = (totalMinutes) =>
				durationFormatter.value(totalMinutes);

			const items = shallowRef([]);
			const categories = shallowRef([]);
			const categoryStates = shallowRef({});

			const page = ref(0);
			const hasMore = ref(true);
			const totalCount = ref(null);

			const loading = ref(false);
			const loadingCategories = ref(true);
			const errorMessage = ref(null);
			const categoriesError = ref(null);

			const sentinel = useTemplateRef("sentinel");
			const resultsHeading = useTemplateRef("resultsHeading");
			let observer = null;

			let currentRequestId = 0;
			let debounceTimer = null;
			let effortLevels = [];

			const friendlyError = (err) => {
				if (err.message?.includes("Failed to fetch"))
					return "ui:errors.network";
				return "ui:errors.unknown";
			};

			const fetchCategories = async () => {
				try {
					categoriesError.value = null;
					loadingCategories.value = true;
					const { data, error } = await supabase
						.from("categories")
						.select("id, code_key");

					if (error) throw error;

					const fetchedCategories = data || [];
					categories.value = sortTranslated(
						fetchedCategories,
						(c) => `categories:${c.code_key}`,
					);

					categoryStates.value = Object.fromEntries(
						fetchedCategories.map((c) => [c.id, "ignore"]),
					);
				} catch (err) {
					categoriesError.value = err.message;
				} finally {
					loadingCategories.value = false;
				}
			};

			const cycleCategoryState = (id) => {
				if (id)
					categoryStates.value = updateKey(
						categoryStates.value,
						id,
						nextCategoryState,
					);
			};

			const toggleCategoryInclusion = (id) => {
				if (id)
					categoryStates.value = updateKey(
						categoryStates.value,
						id,
						toggleCategoryState,
					);
			};

			const fetchItems = async (isReset = false) => {
				if (loading.value && !isReset) return;

				const requestId = ++currentRequestId;
				loading.value = true;
				errorMessage.value = null;

				const targetPage = isReset ? 0 : page.value;
				const { from, to } = calculateRange(targetPage, PAGE_SIZE);

				try {
					const includedIds = getCategoryIdsByState(
						categoryStates.value,
						"include",
					);
					const excludedIds = getCategoryIdsByState(
						categoryStates.value,
						"exclude",
					);

					const excludedRecipeIds = await fetchExcludedRecipeIds(
						supabase,
						excludedIds,
					);
					if (requestId !== currentRequestId) return;

					const query = buildRecipesQuery(supabase, {
						includedIds,
						excludedRecipeIds,
						from,
						to,
					});

					const { data, error, count } = await query;
					if (requestId !== currentRequestId) return;
					if (error) throw error;

					const sortNutrientKey = (n) => `ui:nutrition.nutrients.${n.key}`;
					const formattedData = (data || []).map((recipe) =>
						transformRecipe(recipe, effortLevels, (nutrients) =>
							sortTranslated(nutrients, sortNutrientKey),
						),
					);

					items.value = isReset
						? formattedData
						: [...items.value, ...formattedData];
					page.value = targetPage + 1;
					totalCount.value = count;
					hasMore.value =
						items.value.length < count && formattedData.length === PAGE_SIZE;
				} catch (err) {
					errorMessage.value = err.message || "ui:results.connection_error";
				} finally {
					if (requestId === currentRequestId) loading.value = false;
				}
			};

			const fetchEffortLevels = async () => {
				try {
					const { data, error } = await supabase.rpc("get_effort_levels");
					if (error) throw error;

					if (data && Array.isArray(data)) effortLevels = data;
				} catch (_err) {}
			};

			const formatNutrientValue = (val) => {
				if (!val || val === 0) return "0";
				if (val >= 100) return val.toFixed(0);
				if (val >= 10) return val.toFixed(1);
				return val.toFixed(2);
			};

			const formatGram = (amount, unit) => {
				return new Intl.NumberFormat(currentLocale.value, {
					style: "unit",
					unit: unit,
					unitDisplay: "narrow",
				}).format(amount);
			};

			const resetAndFetch = async () => {
				await fetchItems(true);
				resultsHeading.value?.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
				resultsHeading.value?.focus({ preventScroll: true });
			};

			const clearFilters = () =>
				(categoryStates.value = Object.fromEntries(
					categories.value.map((c) => [c.id, "ignore"]),
				));

			watch(categoryStates, () => {
				if (loadingCategories.value) return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => resetAndFetch(), 500);
			});

			const setupIntersectionObserver = () => {
				observer = new IntersectionObserver(
					(entries) => {
						const [entry] = entries;
						if (entry.isIntersecting && hasMore.value && !loading.value)
							fetchItems();
					},
					{ root: null, rootMargin: "200px", threshold: 0.1 },
				);

				if (sentinel.value) observer.observe(sentinel.value);
			};

			onMounted(async () => {
				await Promise.all([fetchEffortLevels(), fetchCategories()]);
				await fetchItems(true);
				setupIntersectionObserver();
			});

			onUnmounted(() => {
				if (debounceTimer) clearTimeout(debounceTimer);
				if (observer) observer.disconnect();
			});

			return {
				currentLocale,
				setLocale,
				getSupportedLocales,
				items,
				categories,
				categoryStates,
				loading,
				loadingCategories,
				errorMessage,
				categoriesError,
				friendlyError,
				hasMore,
				totalCount,
				sentinel,
				clearFilters,
				resetAndFetch,
				cycleCategoryState,
				toggleCategoryInclusion,
				formatPreparationStep,
				formatNutrientValue,
				formatGram,
				formatDuration,
				formatRecipeEquipment,
			};
		},
	});

	app.use(i18nextVue, { i18next });
	app.mount("#app");
})();
