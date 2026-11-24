import {
	onMounted,
	onUnmounted,
	ref,
	shallowRef,
	useTemplateRef,
	watch,
} from "vue";
import { useLocale } from "../composables/useLocale.js";
import { sortTranslated } from "../i18n.js";
import { supabase } from "../lib/supabase.js";
import {
	buildRecipesQuery,
	calculateRange,
	fetchExcludedRecipeIds,
	formatPreparationStep,
	formatRecipeEquipment,
	getCategoryIdsByState,
	nextCategoryState,
	PAGE_SIZE,
	toggleCategoryState,
	transformRecipe,
	updateKey,
} from "../utils/recipes.js";

export default {
	name: "RecipeSelectionView",
	setup() {
		const { currentLocale, formatDuration } = useLocale();

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
			if (err.message?.includes("Failed to fetch")) return "ui:errors.network";
			return "ui:errors.unknown";
		};

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

		watch(currentLocale, applyGlobalSorting);

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
			resultsHeading,
			fetchCategories,
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
	template: `
        <section class="filters" aria-labelledby="filters-title">
            <h2 id="filters-title" class="section-title">{{ $t('ui:filters.title') }}</h2>

            <form class="filters__form" @submit.prevent>
                <fieldset class="filters__group">
                    <legend class="filters__legend">{{ $t('ui:categories.title') }}</legend>

                    <p v-if="loadingCategories" class="status filters__status" role="status" aria-busy="true">
                        {{ $t('ui:categories.loading') }}
                    </p>

                    <div v-else-if="categoriesError" class="alert filters__alert" role="alert">
                        <p class="alert__message">
                            {{ $t('ui:categories.error', { error: $t(friendlyError(categoriesError)) }) }}
                        </p>
                        <button class="alert__retry" type="button" @click="fetchCategories">{{ $t('ui:actions.retry') }}</button>
                    </div>

                    <p v-else-if="categories.length === 0" class="empty-state">
                        {{ $t('ui:categories.none_found') }}
                    </p>

                    <template v-else>
                        <ul class="filters__list">
                            <li v-for="category in categories" :key="category.id" class="filters__list-item">
                                <button
                                    class="filters__chip"
                                    type="button"
                                    :aria-pressed="categoryStates[category.id] === 'include' ? 'true' : categoryStates[category.id] === 'exclude' ? 'mixed' : 'false'"
                                    :aria-label="$t('ui:filters.category_aria', { name: $t('categories:' + category.code_key), state: $t('ui:filters.states.' + categoryStates[category.id]) })"
                                    @click="cycleCategoryState(category.id)">
                                    <span class="filters__chip-box" aria-hidden="true"></span>
                                    <span class="filters__chip-label">{{ $t('categories:' + category.code_key) }}</span>
                                </button>
                            </li>
                        </ul>

                        <button
                            class="filters__clear"
                            type="button"
                            @click="clearFilters"
                            :disabled="!Object.values(categoryStates).some(s => s !== 'ignore')">
                            {{ $t('ui:filters.clear') }}
                        </button>
                    </template>
                </fieldset>
            </form>
        </section>

        <section class="results" aria-labelledby="results-title" :aria-busy="loading">
            <h2 id="results-title" class="section-title" tabindex="-1" ref="resultsHeading">{{ $t('ui:results.title') }}</h2>

            <div v-if="errorMessage" class="alert" role="alert">
                <p class="alert__message">{{ $t('ui:results.error', { error: $t(friendlyError(errorMessage)) }) }}</p>
                <button class="alert__retry" type="button" @click="resetAndFetch">{{ $t('ui:actions.retry') }}</button>
            </div>

            <template v-else>
                <p v-if="totalCount !== null" class="results__count" aria-live="polite" aria-atomic="true">
                    <output class="results__count-badge">{{ totalCount }}</output>
                    {{ $t('ui:results.found', { count: totalCount }) }}
                </p>

                <p v-if="!loading && items.length === 0" class="empty-state">
                    {{ $t('ui:results.none_found') }}
                </p>

                <div v-else class="results__grid">
                    <article v-for="item in items" :key="item.id" class="card">
                        <h3 class="card__title">{{ $t('recipes:' + item.name_key) }}</h3>

                        <div class="card__categories">
                            <strong class="card__categories-label">{{ $t('ui:categories.title') }}</strong>
                            <template v-if="item.recipe_categories && item.recipe_categories.length > 0">
                                <button
                                    v-for="rc in item.recipe_categories"
                                    :key="rc.categories?.id"
                                    class="card__category-chip"
                                    type="button"
                                    :aria-pressed="categoryStates[rc.categories?.id] === 'include'"
                                    @click="toggleCategoryInclusion(rc.categories?.id)">
                                    {{ $t('categories:' + rc.categories?.code_key) }}
                                </button>
                            </template>
                            <span v-else class="card__categories-empty">{{ $t('ui:categories.none_assigned') }}</span>
                        </div>
                        <p class="card__description">{{ $t('recipes:' + item.description_key) }}</p>
                        <ul class="card__metrics">
                            <li class="card__metric">
                                <strong class="card__metric-label">{{ $t('ui:recipe.total_time') }}</strong>
                                {{ formatDuration(item.total_duration_minutes) }}
                            </li>
                            <li class="card__metric">
                                <strong class="card__metric-label">{{ $t('ui:recipe.difficulty_label') }}</strong>
                                {{ $t('ui:recipe.difficulty.' + item.difficulty_level) }}
                            </li>
                            <li class="card__metric">
                                <strong class="card__metric-label">{{ $t('ui:recipe.equipment', { count: item.preparation_steps?.length || 0 }) }}</strong>
                                {{ formatRecipeEquipment(item.preparation_steps, currentLocale, $t) }}
                            </li>
                            <li class="card__metric">
                                <strong class="card__metric-label">{{ $t('ui:recipe.portion_size') }}</strong>
                                {{ formatGram(100, 'gram') }}
                            </li>
                            <li class="card__metric">
                                <strong class="card__metric-label">{{ $t('ui:recipe.calories_per_portion') }}</strong>
                                {{ item.portion_calories.toFixed(0) }} kcal
                            </li>
                        </ul>

                        <details class="card__section">
                            <summary class="card__summary"><strong>{{ $t('ui:recipe.ingredients_title') }}</strong></summary>
                            <ul class="card__ingredients">
                                <li v-for="ri in item.recipe_ingredients" :key="ri.ingredients?.id" class="card__ingredient">
                                    {{ $t('ui:recipe.ingredient_item', { quantity: formatGram(ri.quantity_grams, ri.ingredients.unit), name: $t('ingredients:' + ri.ingredients?.code_key) }) }}
                                </li>
                            </ul>
                        </details>

                        <details class="card__section">
                            <summary class="card__summary"><strong>{{ $t('ui:recipe.steps_title') }}</strong></summary>
                            <ol class="card__steps">
                                <li v-for="step in item.preparation_steps" :key="step.step_number" class="card__step">
                                    <p class="card__step-text">
                                        {{ formatPreparationStep(step.action_key, currentLocale, $t) }}
                                        <span v-if="step.duration_minutes > 0" class="card__step-duration">({{ formatDuration(step.duration_minutes) }})</span>
                                        <template v-if="step.equipment">
                                            — <small class="card__step-equipment"><strong>{{ $t('ui:recipe.equipment', { count: 1 }) }}</strong> {{ $t('equipment:' + step.equipment.code_key) }}</small>
                                        </template>
                                    </p>
                                </li>
                            </ol>
                        </details>

                        <details class="card__section">
                            <summary class="card__summary"><strong>{{ $t('ui:nutrition.title') }}</strong></summary>
                            <div class="card__table-clip">
                                <div class="card__table-scroll">
                                    <table class="card__nutrition">
                                        <thead>
                                            <tr>
                                                <th>{{ $t('ui:nutrition.nutrient') }}</th>
                                                <th>{{ $t('ui:nutrition.per_portion') }} ({{ formatGram(100, 'gram') }})</th>
                                                <th>{{ $t('ui:nutrition.total_recipe') }} ({{ formatGram(item.total_yield_grams, 'gram') }})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="nut in item.nutrients" :key="nut.key">
                                                <td>{{ $t('ui:nutrition.nutrients.' + nut.key) }}</td>
                                                <td>
                                                    {{ formatNutrientValue(nut.portion) }}
                                                    {{ $t('ui:nutrition.units.' + nut.key, { defaultValue: 'g' }) }}
                                                </td>
                                                <td>
                                                    {{ formatNutrientValue(nut.total) }}
                                                    {{ $t('ui:nutrition.units.' + nut.key, { defaultValue: 'g' }) }}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </details>
                    </article>
                </div>

                <div class="results__sentinel" ref="sentinel">
                    <p v-if="loading" class="status" role="status" aria-busy="true">{{ $t('ui:results.loading_more') }}</p>
                    <p v-else-if="!hasMore && items.length > 0" class="results__end">{{ $t('ui:results.end') }}</p>
                </div>
            </template>
        </section>
    `,
};
