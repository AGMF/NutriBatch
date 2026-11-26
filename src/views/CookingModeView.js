import {
    computed,
    onMounted,
    onUnmounted,
    ref, 
    watch,
} from "vue";
import { useRoute, useRouter } from "vueRouter";
import { i18next } from "../i18n.js";
import { supabase } from "../lib/supabase.js";
import { useLocale } from "../composables/useLocale.js";
import { planner } from "../stores/planner.js";
import { generateDietPlan } from "../utils/mealPlanner.js";
import { scheduleCooking } from "../utils/cookingScheduler.js";
import {
    BASE_SELECT_FIELDS,
    formatPreparationStep,
    transformRecipe,
} from "../utils/recipes.js";

const translate = i18next.t.bind(i18next);
const SCOPE_LOTE = "lote";

const getScopedRecipes = (recipes, scope) => {
    if (!scope || scope === SCOPE_LOTE) return recipes;
    const match = /^day-(\d)$/.exec(scope);
    if (!match) return recipes;

    const dayIndex = Number(match[1]);
    const plan = generateDietPlan(recipes, planner);
    const dayPlan = plan.find((d) => d.day === dayIndex);
    if (!dayPlan) return recipes;

    const idsInDay = new Set();
    for (const meal of dayPlan.meals)
        for (const recipe of meal.recipes)
            idsInDay.add(recipe.id);

    return recipes.filter((r) => idsInDay.has(r.id));
};

export default {
    name: "CookingModeView",
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { currentLocale } = useLocale();

        const blocks = ref([]);
        const currentIndex = ref(0);
        const loading = ref(true);
        const error = ref(null);
        const remaining = ref(0);
        const timerEndsAt = ref(null);
        const wakeLock = ref(null);

        let tickId = null;
        let originalOverflow = "";

        const currentBlock = computed(() => blocks.value[currentIndex.value]);
        const totalBlocks = computed(() => blocks.value.length);

        const currentStep = computed(() => {
            const b = currentBlock.value;
            if (!b) return null;
            return b.passive ?? b.active[0] ?? null;
        });

        const activeTasks = computed(() => currentBlock.value?.active ?? []);

        const timerActive = computed(() => (currentStep.value?.duration_minutes ?? 0) > 0);

        const timerDone = computed(() => timerActive.value && remaining.value === 0);

        const canPrev = computed(() => currentIndex.value > 0);
        const canNext = computed(() => currentIndex.value < totalBlocks.value - 1);

        const formatStep = (actionKey) =>
            formatPreparationStep(actionKey, currentLocale.value, translate);

        const formatTime = (secs) => {
            const safe = Math.max(0, secs | 0);
            const m = Math.floor(safe / 60);
            const s = safe % 60;
            return `${m}:${String(s).padStart(2, "0")}`;
        };

        const tick = () => {
            if (!timerEndsAt.value) {
                remaining.value = 0;
                return;
            }
            remaining.value = Math.max(
                0,
                Math.floor((timerEndsAt.value - Date.now()) / 1000),
            );
        };

        const startTimer = () => {
            if (tickId) clearInterval(tickId);
            tickId = null;

            const duration = currentStep.value?.duration_minutes ?? 0;
            if (duration <= 0) {
                timerEndsAt.value = null;
                remaining.value = 0;
                return;
            }

            timerEndsAt.value = Date.now() + duration * 60 * 1000;
            tick();
            tickId = setInterval(tick, 250);
        };

        const stopTimer = () => {
            if (tickId) {
                clearInterval(tickId);
                tickId = null;
            }
            timerEndsAt.value = null;
            remaining.value = 0;
        };

        const next = () => {
            if (canNext.value) currentIndex.value += 1;
        };
        const prev = () => {
            if (canPrev.value) currentIndex.value -= 1;
        };
        const exit = () => router.push({ name: "diet" });

        const requestWakeLock = async () => {
            if (wakeLock.value) return;
            if (!("wakeLock" in navigator)) return;
            if (document.visibilityState !== "visible") return;
            try {
                wakeLock.value = await navigator.wakeLock.request("screen");
                wakeLock.value.addEventListener?.("release", () => wakeLock.value = null );
            } catch (_err) {
                wakeLock.value = null;
            }
        };

        const releaseWakeLock = () => {
            try {
                wakeLock.value?.release?.();
            } catch (_err) {}
            wakeLock.value = null;
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                requestWakeLock();
                tick();
            }
        };

        const onKeydown = (e) => {
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                next();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prev();
            } else if (e.key === "Escape") {
                exit();
            }
        };

        const load = async () => {
            loading.value = true;
            error.value = null;

            try {
                const ids = planner.selectedRecipeIds;
                if (!ids || ids.length === 0) {
                    blocks.value = [];
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from("recipes")
                    .select(BASE_SELECT_FIELDS)
                    .in("id", ids);

                if (fetchError) throw fetchError;

                const recipes = (data ?? []).map((r) => transformRecipe(r, []));
                const scoped = getScopedRecipes(recipes, route.params.scope);

                blocks.value = scheduleCooking(scoped);
                currentIndex.value = 0;
            } catch (err) {
                error.value = err;
            } finally {
                loading.value = false;
            }
        };

        watch(currentStep, startTimer);

        onMounted(async () => {
            originalOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = "hidden";
            window.addEventListener("keydown", onKeydown);
            document.addEventListener("visibilitychange", onVisibilityChange);

            await load();
            await requestWakeLock();
        });

        onUnmounted(() => {
            stopTimer();
            releaseWakeLock();
            window.removeEventListener("keydown", onKeydown);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            document.documentElement.style.overflow = originalOverflow;
        });

        return{
            blocks,
            currentBlock,
            currentIndex,
            totalBlocks,
            currentStep,
            activeTasks,
            timerActive,
            timerDone,
            remaining,
            loading,
            error,
            canPrev,
            canNext,
            next,
            prev,
            exit,
            formatTime,
            formatStep,
            currentLocale,
        };
    },
    template: `
        <div
            class="cooking"
            role="application"
            :aria-label="$t('ui:cooking.region')">
            <header class="cooking__header">
                <button type="button" class="cooking__exit" @click="exit">
                    ← {{ $t('ui:cooking.exit') }}
                </button>
                <p class="cooking__progress" aria-live="polite" aria-atomic="true">
                    {{ $t('ui:cooking.progress', { current: currentIndex + 1, total: totalBlocks }) }}
                </p>

                <p v-if="loading" class="cooking__status status" role="status" aria-busy="true">
                    {{ $t('ui:cooking.loading') }}
                </p>

                <div v-else-if="error" class="cooking__status">
                    <div class="alert" role="alert">
                        <p class="alert__message">{{ $t('ui:errors.unknown') }}</p>
                    </div>
                </div>

                <p v-else-if="totalBlocks === 0" class="cooking__status">
                    {{ $t('ui:cooking.empty') }}
                </p>

                <template v-else>
                    <main class="cooking__stage">
                        <section
                            v-if="currentBlock.passive"
                            class="cooking__step cooking__step--passive">
                            <p class="cooking__step-recipe">
                                {{ $t('recipes:' + currentBlock.passive.recipeNameKey) }}
                            </p>
                            <h2 class="cooking__step-label">{{ $t('ui:cooking.passive_label') }}</h2>
                            <p class="cooking__step-text">{{ formatStep(currentBlock.passive.action_key) }}</p>
                            <p
                                v-if="timerActive"
                                class="cooking__timer"
                                :class="{ 'cooking__timer--done': timerDone }"
                                aria-live="off">{{ formatTime(remaining) }}</p>
                        </section>

                        <section v-if="activeTasks.length" class="cooking__active">
                            <h3 class="cooking__active-title">{{ $t('ui:cooking.active_title') }}</h3>
                            <ul class="cooking__active-list">
                                <li
                                    v-for="(task, i) in activeTasks"
                                    :key="task.recipeId + '-' + task.step_number + '-' + i"
                                    class="cooking__active-item">
                                    <span class="cooking__active-recipe">
                                        {{ $t('recipes:' + task.recipeNameKey) }}
                                    </span>
                                    <span class="cooking__active-action">{{ formatStep(task.action_key) }}</span>
                                </li>
                            </ul>
                        </section>
                    </main>

                    <footer class="cooking__controls">
                        <button
                            type="button"
                            class="cooking__nav cooking__nav--prev"
                            :disabled="!canPrev"
                            @click="prev">← {{ $t('ui:cooking.prev') }}</button>
                        <button
                            type="button"
                            class="cooking__nav cooking__nav--next"
                            :disabled="!canNext"
                            @click="next">{{ $t('ui:cooking.next') }} →</button>
                    </footer>
                </template>
            </header>
        </div>
    `
};
