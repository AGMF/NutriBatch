import { createClient } from "supabase";
import { createApp, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import { sortBy } from "lodashEs";
import {
	getSupportedLocales,
	i18next,
	i18nextVue,
	initI18n,
	sortTranslated,
	useTranslation
} from "./i18n.js";

const SUPABASE_URL = "https://ecwvgqzzmxnngfhjlejk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_1uOWx-SNjBrH1ZZSexaLUA_INC5yBQc";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PAGE_SIZE = 10;

(async () => {
	await initI18n();

	const app = createApp({
		setup() {
			const { i18next: i18n, t } = useTranslation();
			const currentLocale = ref(i18n.resolvedLanguage);

			const applyGlobalSorting = () => {
				if (categories.value.length > 0)
					categories.value = sortTranslated(categories.value, (c) => `categories:${c.code_key}`);

				if (items.value.length > 0) {
					items.value = items.value.map((recipe) => ({
						...recipe,
						recipe_ingredients: sortTranslated(recipe.recipe_ingredients, (ri) => `ingredients:${ri.ingredients?.code_key}`),
						nutrients: sortTranslated(recipe.nutrients, (n) => `ui:nutrition.nutrients.${n.key}`)
					}));
				}
			};

			const setLocale = async (locale) => {
				await i18n.changeLanguage(locale);
				currentLocale.value = i18n.resolvedLanguage;
				applyGlobalSorting();
			};

			const formatDuration = (totalMinutes) => {
				const formatter = new Intl.DurationFormat(currentLocale.value, { style: 'narrow' });
				const hours = Math.floor(totalMinutes / 60);
				const minutes = totalMinutes % 60;

				return formatter.format({ hours, minutes });
			};

			const items = shallowRef([]);
			const categories = shallowRef([]);
			const categoryStates = shallowRef({});

			const page = ref(0);
			const hasMore = ref(true);
			const totalCount = ref(null);

			const loading = ref(false);
			const loadingCategories = ref(true);
			const errorMessage = ref(null);

			const sentinel = useTemplateRef("sentinel");
			let observer = null;

			let currentRequestId = 0;
			let debounceTimer = null;
			let effortLevels = [];

			const fetchCategories = async () => {
				try {
					loadingCategories.value = true;
					const { data, error } = await supabase
						.from("categories")
						.select("id, code_key");

					if (error) throw error;

					const fetchedCategories = data || [];
					categories.value = sortTranslated(fetchedCategories, (c) => `categories:${c.code_key}`);

					const initialStates = {};
					fetchedCategories.forEach((c) => initialStates[c.id] = "ignore");
					categoryStates.value = initialStates;
				} catch (err) {
					errorMessage.value = err.message;
				} finally {
					loadingCategories.value = false;
				}
			};

			const cycleCategoryState = (categoryId) => {
				if (!categoryId) return;

				const currentState = categoryStates.value[categoryId] || "ignore";
				const newStates = { ...categoryStates.value };

				if (currentState === "ignore") newStates[categoryId] = "include";
				else if (currentState === "include") newStates[categoryId] = "exclude";
				else newStates[categoryId] = "ignore";

				categoryStates.value = newStates;
			};

			const toggleCategoryInclusion = (categoryId) => {
				if (!categoryId) return;

				const currentState = categoryStates.value[categoryId];
				const newStates = { ...categoryStates.value };
				newStates[categoryId] = currentState === "include" ? "ignore" : "include";

				categoryStates.value = newStates;
			};

			const getCategoryBadge = (state) => {
				if (state === "include") return "[+] ";
				if (state === "exclude") return "[-] ";
				return "";
			};

			const fetchItems = async (isReset = false) => {
				if (loading.value && !isReset) return;

				const requestId = ++currentRequestId;

				loading.value = true;
				errorMessage.value = null;

				const targetPage = isReset ? 0 : page.value;
				const from = targetPage * PAGE_SIZE;
				const to = from + PAGE_SIZE - 1;

				try {
					const includedIds = Object.keys(categoryStates.value).filter((id) => categoryStates.value[id] === "include");
					const excludedIds = Object.keys(categoryStates.value).filter((id) => categoryStates.value[id] === "exclude");

					let excludedRecipeIds = [];
					if (excludedIds.length > 0) {
						const { data: excludedData, error: excludedErr } = await supabase
							.from("recipe_categories")
							.select("recipe_id")
							.in("category_id", excludedIds);

						if (requestId !== currentRequestId) return;
						if (excludedErr) throw excludedErr;
						if (excludedData && excludedData.length > 0) excludedRecipeIds = [...new Set(excludedData.map((row) => row.recipe_id))];
					}

					let selectClause = `
                        id,
                        name_key,
                        description_key,
                        yield_factor,
                        created_at,
                        recipe_categories(category_id, categories(id, code_key)),
						preparation_steps(step_number, action_key, equipment(id, code_key), effort_type, duration_minutes, is_active),
						recipe_ingredients(quantity_grams, ingredients(*))
                    `;

					includedIds.forEach((_, index) => selectClause += `, rc_${index}:recipe_categories!inner(category_id)`);

					let query = supabase
						.from("recipes")
						.select(selectClause, { count: "exact" });

					includedIds.forEach((id, index) => { query = query.eq(`rc_${index}.category_id`, id); });

					if (excludedRecipeIds.length > 0) query = query.not("id", "in", `(${excludedRecipeIds.join(",")})`);

					query = query
						.range(from, to)
						.order("created_at", { ascending: false });

					const { data, error, count } = await query;
					if (requestId !== currentRequestId) return;
					if (error) throw error;

					const formattedData = (data || []).map((recipe) => {
						if (recipe.recipe_categories && Array.isArray(recipe.recipe_categories))
							recipe.recipe_categories = sortTranslated(recipe.recipe_categories, (rc) => `categories:${rc.categories?.code_key}`);
						if (recipe.recipe_ingredients && Array.isArray(recipe.recipe_ingredients))
							recipe.recipe_ingredients = sortTranslated(recipe.recipe_ingredients, (ri) => `ingredients:${ri.ingredients?.code_key}`);
						if (recipe.preparation_steps && Array.isArray(recipe.preparation_steps))
							recipe.preparation_steps = sortBy(recipe.preparation_steps, "step_number");

						const totalDuration = (recipe.preparation_steps || []).reduce((acc, step) => acc + (step.duration_minutes || 0), 0);

						let totalWeight = 0;
						const totals = {};

						(recipe.recipe_ingredients || []).forEach((ri) => {
							const qty = Number(ri.quantity_grams) || 0;
							const ing = ri.ingredients || {};
							totalWeight += qty;

							Object.entries(ing).forEach(([key, val]) => {
								if (key.endsWith("_100g") && val !== null) {
									const nutrientKey = key.replace("_100g", "");
									const numericVal = Number(val) || 0;
									totals[nutrientKey] = (totals[nutrientKey] || 0) + (qty / 100) * numericVal;
								}
							});
						});

						const yieldFactor = Number(recipe.yield_factor);
						const totalYieldGrams = Math.round(totalWeight * yieldFactor);

						const PORTION_WEIGHT = 100;
						const portionFactor = totalWeight > 0 ? PORTION_WEIGHT / totalWeight : 0;

						const nutrients = sortTranslated(
							Object.entries(totals)
								.filter(([_, totalVal]) => totalVal > 0)
								.map(([key, totalVal]) => ({
									key,
									total: totalVal,
									portion: totalVal * portionFactor,
								})),
								(n) => `ui:nutrition.nutrients.${n.key}`
							);

						const caloriesNutrient = nutrients.find((n) => n.key === "calories");
						const portionCalories = caloriesNutrient ? caloriesNutrient.portion : 0;
						const difficultyLevel = calculateDifficulty(recipe.preparation_steps, effortLevels);

						return {
							...recipe,
							total_duration_minutes: totalDuration,
							portion_calories: portionCalories,
							total_yield_grams: totalYieldGrams,
							difficulty_level: difficultyLevel,
							nutrients
						};
					});

					if (isReset) {
						items.value = formattedData;
						page.value = 1;
					} else {
						items.value = [...items.value, ...formattedData];
						page.value++;
					}

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
					const { data, error } = await supabase.rpc('get_effort_levels');
					if (error) throw error;

					if (data && Array.isArray(data)) effortLevels = data;
				} catch (err) {
					console.error('Erro ao buscar enum effort_level:', err.message || err);
				}
			};

			const formatNutrientValue = (val) => {
				if (!val || val === 0) return "0";
				if (val >= 100) return val.toFixed(0);
				if (val >= 10) return val.toFixed(1);
				return val.toFixed(2);
			};

			const formatPreparationStep = (rawActionKey) => {
				if (!rawActionKey) return "";

				const [actionAndTargets, modifierKey] = rawActionKey.split("@");
				const [action, rawTarget] = actionAndTargets.split("__");

				let modifierText = "";
				if (modifierKey) {
					const translatedModifier = t(`modifiers:${modifierKey}`, { defaultValue: modifierKey });
					modifierText = ` ${translatedModifier}`;
				}

				let formattedTargets = "";
				if (rawTarget) {
					const targetKeys = rawTarget.split("-and-");
					const translatedTargets = targetKeys.map((key) => t(`ingredients:${key}`, { context: "article", defaultValue: key }));

					const listFormatter = new Intl.ListFormat(currentLocale.value, { style: "long", type: "conjunction" });
					formattedTargets = listFormatter.format(translatedTargets);
				}

				return t(`actions:${action}`, {
					target: formattedTargets,
					modifier: modifierText,
					defaultValue: `${action} ${formattedTargets}${modifierText}`.trim()
				});
			};

			const formatGram = (amount, unit) => {
				return new Intl.NumberFormat(currentLocale.value, {
					style: "unit",
					unit: unit,
					unitDisplay: "narrow"
				}).format(amount);
			};

			const formatRecipeEquipment = (steps) => {
				if (!steps || steps.length === 0) return "";

				const rawKeys = steps
					.map((s) => s.equipment.code_key)
					.filter(Boolean)
					.flatMap((key) => key.split("-and-"));
				if (rawKeys.length === 0) return "";

				const translatedEquipment = [...new Set(rawKeys.map((key) => t(`equipment:${key}`)))]
					.sort((a, b) => a.localeCompare(b, currentLocale.value));

				const listFormatter = new Intl.ListFormat(currentLocale.value, { style: "long", type: "conjunction" });
				return listFormatter.format(translatedEquipment);
			};

			const calculateDifficulty = (steps, effortLevels) => {
				if (!steps || steps.length === 0) return effortLevels[0];

				const totalTiers = effortLevels.length;
				const effortWeights = {};
				effortLevels.forEach((level, index) => effortWeights[level] = index++);

				let activeMinutes = 0;
				let effortScore = 0;
				let hasMaxEffort = false;

				steps.forEach((s) => {
					const weight = effortWeights[s.effort_type];
					if (weight === totalTiers) hasMaxEffort = true;

					if (s.is_active) {
						const duration = s.duration_minutes;
						activeMinutes += duration;
						effortScore += weight * duration;
					}
				});

				const totalScore = activeMinutes + effortScore * 0.5 + steps.length * 0.8;
				const REFERENCE_MAX_SCORE = 45;
				const normalizedRatio = Math.min(totalScore / REFERENCE_MAX_SCORE, 0.99);
				let levelIndex = Math.floor(normalizedRatio * totalTiers);

				if (hasMaxEffort && levelIndex === 0 && totalTiers > 1) levelIndex = 1;

				return effortLevels[levelIndex];
			};

			const resetAndFetch = async () => await fetchItems(true);

			const clearFilters = () => {
				const resetStates = {};
				categories.value.forEach((category) => resetStates[category.id] = "ignore");
				categoryStates.value = resetStates;
			};

			watch(categoryStates, () => {
				if (loadingCategories.value) return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => resetAndFetch(), 500);
			}, { deep: true });

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
				await fetchEffortLevels();
				await fetchCategories();
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
				hasMore,
				totalCount,
				sentinel,
				clearFilters,
				resetAndFetch,
				cycleCategoryState,
				toggleCategoryInclusion,
				getCategoryBadge,
				formatPreparationStep,
				formatNutrientValue,
				formatGram,
				formatDuration,
				formatRecipeEquipment
			};
		},
	});

	app.use(i18nextVue, { i18next });
	app.mount("#app");
})();
