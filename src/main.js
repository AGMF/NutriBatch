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
import {
	supabase
} from "./lib/supabase.js";
import {
	PAGE_SIZE,
	buildRecipesQuery,
	calculateRange,
	createDurationFormatter,
	fetchExcludedRecipeIds,
	formatPreparationStep,
	formatRecipeEquipment,
	getCategoryIdsByState,
	nextCategoryState,
	toggleCategoryState,
	transformRecipe,
	updateKey,
} from "./utils/recipes.js";

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
