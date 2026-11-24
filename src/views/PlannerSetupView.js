import { useRouter } from "vueRouter";
import { computed } from "vue";
import {
	addMeal,
	MEAL_TYPES,
	planner,
	removeMeal,
	resetPlanner,
	toggleDay,
} from "../stores/planner.js";

export default {
	name: "PlannerSetupView",
	setup() {
		const router = useRouter();

		const DAYS = [
			{ value: 1, key: "mon" },
			{ value: 2, key: "tue" },
			{ value: 3, key: "wed" },
			{ value: 4, key: "thu" },
			{ value: 5, key: "fri" },
			{ value: 6, key: "sat" },
			{ value: 0, key: "sun" },
		];

		const dailyKcal = computed({
			get: () => planner.dailyKcal,
			set: (v) => {
				const n = Number(v);
				planner.dailyKcal = Number.isFinite(n) && n >= 0 ? n : 0;
			},
		});

		const stepKcal = (delta) => {
			const current = Number(planner.dailyKcal) || 1000;
			const next = Math.min(10000, Math.max(1000, current + delta));
			planner.dailyKcal = next;
		};

		const stepRatio = (meal, delta) => {
			const current = Number(meal.ratio) || 0;
			meal.ratio = Math.min(100, Math.max(0, current + delta));
		};

		const totalRatio = computed(() =>
			planner.meals.reduce((sum, m) => sum + (Number(m.ratio) || 0), 0),
		);

		const ratioOk = computed(() => Math.abs(totalRatio.value - 100) < 0.5);

		const canContinue = computed(
			() =>
				planner.dailyKcal > 0 &&
				planner.selectedDays.length > 0 &&
				planner.meals.length > 0 &&
				ratioOk.value,
		);

		const normalizeRatios = () => {
			const total = planner.meals.reduce(
				(sum, m) => sum + Math.max(0, Number(m.ratio) || 0),
				0,
			);

			if (total <= 0) return;
			const TARGET_UNITS = 20;
			const entries = planner.meals.map((m, index) => {
				const raw = Math.max(0, Number(m.ratio) || 0);
				const exactUnits = (raw / total) * TARGET_UNITS;
				const floorUnits = Math.floor(exactUnits);
				return {
					index,
					raw,
					units: floorUnits,
					remainder: exactUnits - floorUnits,
				};
			});

			const remainingUnits =
				TARGET_UNITS - entries.reduce((sum, e) => sum + e.units, 0);

			const byRemainder = [...entries].sort(
				(a, b) => b.remainder - a.remainder || b.raw - a.raw,
			);

			for (let i = 0; i < remainingUnits; i++) byRemainder[i].units += 1;

			planner.meals = planner.meals.map((m, index) => ({
				...m,
				ratio: entries[index].units * 5,
			}));
		};

		const continueToRecipes = () => {
			if (!canContinue.value) return;
			router.push({ name: "recipes" });
		};

		return {
			planner,
			MEAL_TYPES,
			DAYS,
			addMeal,
			removeMeal,
			toggleDay,
			resetPlanner,
			dailyKcal,
			stepKcal,
			stepRatio,
			totalRatio,
			ratioOk,
			canContinue,
			normalizeRatios,
			continueToRecipes,
		};
	},
	template: `
        <div class="planner-page">
            <section class="planner-intro">
                <h2 class="section-title">{{ $t('ui:planner.title') }}</h2>
                <p class="planner-intro__subtitle">{{ $t('ui:planner.subtitle') }}</p>
            </section>

            <form class="planner" @submit.prevent="continueToRecipes">
                <fieldset class="planner__section">
                    <legend id="kcal-legend" class="planner__legend">{{ $t('ui:planner.kcal.label') }}</legend>
                    <div class="planner__input-group">
                        <button
                            type="button"
                            class="planner__input-step"
                            :disabled="dailyKcal <= 1000"
                            :aria-label="$t('ui:planner.kcal.label') + ' -50'"
                            @click="stepKcal(-50)">-</button>
                        <input
                            id="daily-kcal"
                            type="number"
                            min="1000"
                            max="10000"
                            step="50"
                            v-model="dailyKcal"
                            class="planner__input"
                            aria-labelledby="kcal-legend"
                            aria-describedby="kcal-hint"
                            required
                            inputmode="numeric"/>
                        <span class="planner__input-suffix" aria-hidden="true">{{ $t('ui:planner.kcal.unit') }}</span>
                        <button
                            type="button"
                            class="planner__input-step"
                            :disabled="dailyKcal >= 10000"
                            :aria-label="$t('ui:planner.kcal.label') + ' +50'"
                            @click="stepKcal(50)">+</button>
                    </div>
                    <p id="kcal-hint" class="planner__hint planner__hint--centered">{{ $t('ui:planner.kcal.hint') }}</p>
                </fieldset>

                <fieldset class="planner__section">
                    <legend class="planner__legend">{{ $t('ui:planner.days.label') }}</legend>
                    <div class="day-grid" role="group" :aria-label="$t('ui:planner.days.label')">
                        <button
                            v-for="day in DAYS"
                            :key="day.value"
                            type="button"
                            class="day-toggle"
                            :aria-pressed="planner.selectedDays.includes(day.value)"
                            @click="toggleDay(day.value)"
                        >{{ $t('ui:planner.days.short.' + day.key) }}</button>
                    </div>
                    <p class="planner__hint">{{ $t('ui:planner.days.hint') }}</p>
                </fieldset>

                <fieldset class="planner__section">
                    <legend class="planner__legend">{{ $t('ui:planner.meals.label') }}</legend>
                    <p class="planner__hint">{{ $t('ui:planner.meals.hint') }}</p>

                    <ul class="meal-list">
                        <li v-for="(meal, index) in planner.meals" :key="meal.id" class="meal-row">
                            <select
                                v-model="meal.type"
                                class="meal-select"
                                :aria-label="$t('ui:planner.meals.type_label') + ' ' + (index + 1)">
                                <option v-for="type in MEAL_TYPES" :key="type" :value="type">
                                    {{ $t('ui:planner.meal_types.' + type) }}
                                </option>
                            </select>
                            <div class="meal-ratio">
                                <button
                                    type="button"
                                    class="meal-ratio__step"
                                    :disabled="meal.ratio <= 0"
                                    :aria-label="$t('ui:planner.meals.ratio_label') + ' ' + (index + 1) + ' -5%'"
                                    @click="stepRatio(meal, -5)">-</button>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="5"
                                    v-model.number="meal.ratio"
                                    class="meal-ratio__input"
                                    inputmode="numeric"
                                    :aria-label="$t('ui:planner.meals.ratio_label') + ' ' + (index + 1)"/>
                                <span class="meal-ratio__unit" aria-hidden="true">%</span>
                                <button
                                    type="button"
                                    class="meal-ratio__step"
                                    :disabled="meal.ratio >= 100"
                                    :aria-label="$t('ui:planner.meals.ratio_label') + ' ' + (index + 1) + ' +5%'"
                                    @click="stepRatio(meal, 5)">+</button>
                            </div>
                            <button
                                type="button"
                                class="meal-remove"
                                :disabled="planner.meals.length <= 1"
                                :aria-label="$t('ui:planner.meals.remove') + ' ' + (index + 1)"
                                @click="removeMeal(meal.id)">x</button>
                        </li>
                    </ul>

                    <div class="meal-summary">
                        <p
                            class="meal-summary__status"
                            :class="{ 'meal-summary__status--warn': !ratioOk }"
                            role="status"
                            aria-live="polite"
                            aria-atomic="true">
                            {{ $t('ui:planner.meals.total', { value: totalRatio }) }}
                            <span v-if="!ratioOk"> — {{ $t('ui:planner.meals.warn') }}</span>
                        </p>
                        <button
                            type="button"
                            class="meal-summary__normalize"
                            :disabled="ratioOk || totalRatio === 0"
                            @click="normalizeRatios">{{ $t('ui:planner.meals.normalize') }}</button>
                    </div>

                    <button type="button" class="meal-add" @click="addMeal">
                        + {{ $t('ui:planner.meals.add') }}
                    </button>
                </fieldset>

                <div class="planner__actions">
                    <button
                        type="button"
                        class="btn btn--ghost planner__reset"
                        @click="resetPlanner">
                        {{ $t('ui:planner.actions.reset') }}
                    </button>
                    <router-link to="/" class="btn btn--ghost">{{ $t('ui:planner.actions.cancel') }}</router-link>
                    <button type="submit" class="btn btn--primary btn--lg" :disabled="!canContinue">
                        {{ $t('ui:planner.actions.continue') }}
                    </button>
                </div>
            </form>
        </div>
    `,
};
