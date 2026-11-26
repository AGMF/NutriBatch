import { useRouter } from "vueRouter";
import { computed, onMounted, ref } from "vue";
import { useLocale } from "../composables/useLocale.js";
import { sortTranslated } from "../i18n.js";
import { supabase } from "../lib/supabase.js";
import { planner } from "../stores/planner.js";
import { generateDietPlan, summarizePlanMacros } from "../utils/mealPlanner.js";
import { BASE_SELECT_FIELDS, transformRecipe } from "../utils/recipes.js";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export default {
	name: "DietPlanView",
	setup() {
		const router = useRouter();
		const { currentLocale } = useLocale();

		const loading = ref(true);
		const error = ref(null);
		const recipes = ref([]);

		const plan = computed(() => generateDietPlan(recipes.value, planner));
		const totalMacros = computed(() => summarizePlanMacros(plan.value));

		const averageKcal = computed(() => {
			if (!plan.value.length) return 0;
			return Math.round(totalMacros.value.kcal / plan.value.length);
		});

		const dayName = (dayIndex) => DAY_KEYS[dayIndex] ?? String(dayIndex);

		const formatGram = (amount, unit = "gram") =>
			new Intl.NumberFormat(currentLocale.value, {
				style: "unit",
				unit,
				unitDisplay: "narrow",
			}).format(amount);

		const formatNutrientValue = (val) => {
			if (!val || val === 0) return "0";
			if (val >= 100) return val.toFixed(0);
			if (val >= 10) return val.toFixed(1);
			return val.toFixed(2);
		};

		const formatKcal = (val) => Math.round(val ?? 0);

		const friendlyError = (err) => {
			if (err === "no-recipes") return "ui:diet.errors.no_recipes";
			if (err?.message?.includes("Failed to fetch")) return "ui:errors.network";
			return "ui:errors.unknown";
		};

		const loadRecipes = async () => {
			loading.value = true;
			error.value = null;

			const ids = planner.selectedRecipeIds;
			if (!ids || ids.length === 0) {
				error.value = "no-recipes";
				loading.value = false;
				return;
			}

			try {
				const { data, error: fetchError } = await supabase
					.from("recipes")
					.select(BASE_SELECT_FIELDS)
					.in("id", ids);

				if (fetchError) throw fetchError;

				const sortNutrientKey = (n) => `ui:nutrition.nutrients.${n.key}`;
				recipes.value = (data || []).map((recipe) =>
					transformRecipe(recipe, [], (nutrients) =>
						sortTranslated(nutrients, sortNutrientKey),
					),
				);
			} catch (err) {
				error.value = err;
			} finally {
				loading.value = false;
			}
		};

		const backToRecipes = () => router.push({ name: "recipes" });
		const restart = () => router.push({ name: "planner" });

		onMounted(loadRecipes);

		return {
			loading,
			error,
			plan,
			totalMacros,
			averageKcal,
			dayName,
			formatGram,
			formatNutrientValue,
			formatKcal,
			friendlyError,
			loadRecipes,
			backToRecipes,
			restart,
		};
	},
	template: `
        <div class="diet-page">
            <header class="diet-page__header">
                <h2 class="section-title">{{ $t('ui:diet.title') }}</h2>
                <div class="diet-page__actions">
                    <router-link
                        :to="{ name: 'cooking', params: { scope: 'lote' } }"
                        class="btn btn--primary">
                        {{ $t('ui:diet.start_cooking') }}
                    </router-link>
                    <router-link
                        :to="{ name: 'shopping', query: { scope: 'lote' } }"
                        class="btn btn--ghost">
                        {{ $t('ui:diet.open_shopping') }}
                    </router-link>
                    <button type="button" class="btn btn--ghost" @click="backToRecipes">
                        {{ $t('ui:diet.back') }}
                    </button>
                    <button type="button" class="btn btn--ghost" @click="restart">
                        {{ $t('ui:diet.restart') }}
                    </button>
                </div>
            </header>

            <p v-if="loading" class="status" role="status" aria-busy="true">
                {{ $t('ui:diet.loading') }}
            </p>

            <div v-else-if="error" class="alert" role="alert">
                <p class="alert__message">{{ $t(friendlyError(error)) }}</p>
                <button class="alert__retry" type="button" @click="loadRecipes">
                    {{ $t('ui:actions.retry') }}
                </button>
            </div>

            <p v-else-if="plan.length === 0" class="empty-state">
                {{ $t('ui:diet.empty') }}
            </p>

            <template v-else>
                <div
                    class="diet-summary"
                    role="region"
                    :aria-label="$t('ui:diet.summary_region')">
                    <div class="diet-summary__item">
                        <span class="diet-summary__label">{{ $t('ui:diet.summary.days') }}</span>
                        <strong class="diet-summary__value">{{ plan.length }}</strong>
                    </div>
                    <div class="diet-summary__item">
                        <span class="diet-summary__label">{{ $t('ui:diet.summary.avg_kcal') }}</span>
                        <strong class="diet-summary__value">{{ averageKcal }} kcal</strong>
                    </div>
                    <div class="diet-summary__item">
                        <span class="diet-summary__label">{{ $t('ui:nutrition.nutrients.carbs') }}</span>
                        <strong class="diet-summary__value">{{ formatNutrientValue(totalMacros.carbs) }} g</strong>
                    </div>
                    <div class="diet-summary__item">
                        <span class="diet-summary__label">{{ $t('ui:nutrition.nutrients.proteins') }}</span>
                        <strong class="diet-summary__value">{{ formatNutrientValue(totalMacros.proteins) }} g</strong>
                    </div>
                    <div class="diet-summary__item">
                        <span class="diet-summary__label">{{ $t('ui:nutrition.nutrients.fats') }}</span>
                        <strong class="diet-summary__value">{{ formatNutrientValue(totalMacros.fats) }} g</strong>
                    </div>
                </div>

                <div class="diet-days">
                    <article v-for="day in plan" :key="day.day" class="diet-day">
                        <header class="diet-day__header">
                            <h3 class="diet-day__title">{{ $t('ui:diet.days.' + dayName(day.day)) }}</h3>
                            <p class="diet-day__kcal">
                                <strong>{{ formatKcal(day.totalKcal) }}</strong>
                                / {{ formatKcal(day.targetKcal) }} kcal
                            </p>
                            <router-link
                                :to="{ name: 'cooking', params: { scope: 'day-' + day.day } }"
                                class="diet-day__cook-link">
                                {{ $t('ui:diet.cook_this_day') }}
                            </router-link>
                        </header>

                        <ol class="diet-meals">
                            <li v-for="meal in day.meals" :key="meal.mealId" class="diet-meal">
                                <header class="diet-meal__header">
                                    <h4 class="diet-meal__title">
                                        {{ $t('ui:planner.meal_types.' + meal.mealType) }}
                                    </h4>
                                    <span class="diet-meal__kcal">
                                        {{ formatKcal(meal.actualKcal) }} / {{ formatKcal(meal.targetKcal) }} kcal
                                    </span>
                                </header>

                                <ul class="diet-meal__recipes">
                                    <li v-for="r in meal.recipes" :key="r.id" class="diet-recipe">
                                        <div class="diet-recipe__main">
                                            <h5 class="diet-recipe__name">{{ $t('recipes:' + r.name_key) }}</h5>
                                            <p class="diet-recipe__meta">
                                                <span class="diet-recipe__grams">{{ formatGram(r.grams) }}</span>
                                                <span class="diet-recipe__kcal">{{ formatKcal(r.kcal) }} kcal</span>
                                            </p>
                                        </div>
                                        <ul class="diet-recipe__macros" :aria-label="$t('ui:diet.macros')">
                                            <li>
                                                <span>{{ $t('ui:nutrition.nutrients.carbs') }}</span>
                                                <strong>{{ formatNutrientValue(r.macros.carbs) }} g</strong>
                                            </li>
                                            <li>
                                                <span>{{ $t('ui:nutrition.nutrients.proteins') }}</span>
                                                <strong>{{ formatNutrientValue(r.macros.proteins) }} g</strong>
                                            </li>
                                            <li>
                                                <span>{{ $t('ui:nutrition.nutrients.fats') }}</span>
                                                <strong>{{ formatNutrientValue(r.macros.fats) }} g</strong>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        </ol>
                    </article>
                </div>
            </template>
        </div>
    `,
};
