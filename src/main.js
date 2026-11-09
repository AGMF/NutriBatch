import { createClient } from "supabase";
import { createApp, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import { sortBy } from "lodashEs";
import {
	getSupportedLocales,
	i18next,
	i18nextVue,
	initI18n,
	useTranslation,
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
			const { i18next: i18n } = useTranslation();
			const currentLocale = ref(i18n.resolvedLanguage);

			const setLocale = async (locale) => {
				await i18n.changeLanguage(locale);
				currentLocale.value = i18n.resolvedLanguage;
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

			const fetchCategories = async () => {
				try {
					loadingCategories.value = true;
					const { data, error } = await supabase
						.from("categories")
						.select("id, code_key")
						.order("code_key", { ascending: true });

					if (error) throw error;

					const fetchedCategories = data || [];
					categories.value = fetchedCategories;

					const initialStates = {};
					fetchedCategories.forEach((category) => initialStates[category.id] = "ignore");
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
                        recipe_categories(category_id, categories(id, code_key))
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
						if (
							recipe.recipe_categories &&
							Array.isArray(recipe.recipe_categories)
						)
							recipe.recipe_categories = sortBy(recipe.recipe_categories, "categories.code_key");
						return recipe;
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
				getCategoryBadge
			};
		},
	});

	app.use(i18nextVue, { i18next });
	app.mount("#app");
})();
