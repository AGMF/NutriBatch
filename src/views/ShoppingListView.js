import { computed, onMounted, ref } from "vue";
import { useRoute } from "vueRouter";
import { supabase } from "../lib/supabase.js";
import { useLocale } from "../composables/useLocale.js";
import { planner } from "../stores/planner.js";
import { buildShoppingList } from "../utils/shoppingList.js";
import { generateDietPlan } from "../utils/mealPlanner.js";
import { BASE_SELECT_FIELDS, transformRecipe } from "../utils/recipes.js";

const OWNED_KEY = "nutribatch:shopping-owned";
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const loadOwned = () => {
    try {
        const raw = localStorage.getItem(OWNED_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
    } catch {
        return new Set();
    }
};

const saveOwned = (set) => {
    try {
        localStorage.setItem(OWNED_KEY, JSON.stringify([...set]));
    } catch (_err) {}
};

const computePortions = (plan) => {
    const totals = new Map();
    for (const day of plan)
        for (const meal of day.meals)
            for (const recipe of meal.recipes)
                totals.set(recipe.id, (totals.get(recipe.id) ?? 0) + recipe.grams);
    return Object.fromEntries(totals);
};

const filterPlanByScope = (plan, scope) => {
    if (!scope || scope === "lote") return plan;
    const match = /^dia-(\d)$/.exec(scope);
    if (!match) return plan;
    const dayIndex = Number(match[1]);
    const filtered = plan.filter((d) => d.day === dayIndex);
    return filtered.length ? filtered : plan;
};

export default {
    name: "ShoppingListView",
    setup() {
        const route = useRoute();
        const { currentLocale } = useLocale();

        const items = ref([]);
        const owned = ref(loadOwned());
        const loading = ref(true);
        const error = ref(null);

        const visibleItems = computed(() =>
            items.value.map((item) => ({
                ...item,
                owned: owned.value.has(item.codeKey),
            }))
        );

        const pendingCount = computed(() => visibleItems.value.filter((i) => !i.owned).length);

        const ownedCount = computed(() => visibleItems.value.filter((i) => i.owned).length);

        const scopeKind = computed(() => {
            const scope = route.query.scope;
            if (!scope || scope === "lote") return "lote";
            const match = /^dia-(\d)$/.exec(scope);
            if (match) return "day";
            return "lote";
        });

        const scopeDay = computed(() => {
            const scope = route.query.scope;
            if (!scope) return null;
            const match = /^dia-(\d)$/.exec(scope);
            if (!match) return null;
            return DAY_NAMES[Number(match[1])] ?? null;
        });

        const toggleOwned = (codeKey) => {
            const next = new Set(owned.value);
            if (next.has(codeKey)) next.delete(codeKey);
            else next.add(codeKey);
            owned.value = next;
            saveOwned(next);
        };

        const clearOwned = () => {
            owned.value = new Set();
            saveOwned(owned.value);
        };

        const numberFormat = (unit, value, display = "narrow") =>
            new Intl.NumberFormat(currentLocale.value, {
                style: "unit",
                unit,
                unitDisplay: display,
            }).format(value);

        const formatPurchase = (item) => {
            const q = item.purchaseQuantity;
            const u = item.purchaseUnit;
            if (u === "g") {
                return q >= 1000
                    ? numberFormat("kilogram", q / 1000, "short")
                    : numberFormat("gram", q);
            }
            if (u === "ml") {
                return q >= 1000
                    ? numberFormat("liter", q / 1000, "short")
                    : numberFormat("milliliter", q);
            }
            return `${Math.ceil(q)} ${u}`;
        };

        const formatNeeded = (item) => {
            const q = Math.ceil(item.totalQuantity);
            const u = item.unit;
            if (u === "g") return numberFormat("gram", q);
            if (u === "ml") return numberFormat("milliliter", q);
            return `${q} ${u}`;
        };

        const print = () => window.print();

        const load = async () => {
            loading.value = true;
            error.value = null;

            try {
                const ids = planner.selectedRecipeIds;
                if (!ids || ids.length === 0) {
                    items.value = [];
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from("recipes")
                    .select(BASE_SELECT_FIELDS)
                    .in("id", ids);
                if (fetchError) throw fetchError;

                const recipes = (data ?? []).map((r) => transformRecipe(r, []));
                const plan = generateDietPlan(recipes, planner);
                const scopedPlan = filterPlanByScope(plan, route.query.scope);
                const portions = computePortions(scopedPlan);

                items.value = buildShoppingList(recipes, portions);
            } catch (err) {
                error.value = err;
            } finally {
                loading.value = false;
            }
        };

        onMounted(load);

        return {
            items: visibleItems,
            pendingCount,
            ownedCount,
            scopeKind,
            scopeDay,
            loading,
            error,
            toggleOwned,
            clearOwned,
            formatPurchase,
            formatNeeded,
            print,
            load,
            currentLocale,
        };
    },
    template: `
        <div class="shopping-page">
            <header class="shopping-page__header no-print">
                <div class="shopping-page__heading">
                    <h2 class="section-title">{{ $t('ui:shopping.title') }}</h2>
                    <p class="shopping-page__scope">
                        {{ $t('ui:shopping.scope_label') }}:
                        <strong v-if="scopeKind === 'day' && scopeDay">
                            {{ $t('ui:diet.days.' + scopeDay) }}
                        </strong>
                        <strong v-else>{{ $t('ui:shopping.scopes.lote') }}</strong>
                    </p>
                </div>
                <div class="shopping-page__actions">
                    <router-link to="/diet" class="btn btn--ghost">
                        {{ $t('ui:shopping.back') }}
                    </router-link>
                    <button
                        v-if="ownedCount > 0"
                        type="button"
                        class="btn btn--ghost"
                        @click="clearOwned">{{ $t('ui:shopping.clear_owned') }}</button>
                    <button
                        type="button"
                        class="btn btn--primary"
                        @click="print">{{ $t('ui:shopping.print') }}</button>
                </div>
            </header>

            <p v-if="loading" class="status" role="status" aria-busy="true">
                {{ $t('ui:shopping.loading') }}
            </p>

            <div v-else-if="error" class="alert" role="alert">
                <p class="alert__message">{{ $t('ui:errors.unknown') }}</p>
                <button class="alert__retry" type="button" @click="load">
                    {{ $t('ui:actions.retry') }}
                </button>
            </div>

            <p v-else-if="items.length === 0" class="empty-state">
                {{ $t('ui:shopping.empty') }}
            </p>

            <template v-else>
                <p
                    class="shopping-page__summary"
                    aria-live="polite"
                    aria-atomic="true">
                    {{ $t('ui:shopping.summary', { pending: pendingCount, total: items.length }) }}
                </p>
                <ul class="shopping-list">
                    <li
                        v-for="item in items"
                        :key="item.codeKey"
                        class="shopping-item"
                        :class="{ 'shopping-item--owned': item.owned }">
                        <label class="shopping-item__label">
                            <input
                                type="checkbox"
                                class="shopping-item__check no-print"
                                :checked="item.owned"
                                @change="toggleOwned(item.codeKey)"/>
                            <span class="shopping-item__name">
                                {{ $t('ingredients:' + item.nameKey) }}
                            </span>
                        </label>

                        <div class="shopping-item__quantities">
                            <span class="shopping-item__needed" :title="$t('ui:shopping.needed_label')">
                                {{ formatNeeded(item) }}
                            </span>
                            <span class="shopping-item__purchase">
                                {{ $t('ui:shopping.buy', { qty: formatPurchase(item) }) }}
                            </span>
                        </div>

                        <span v-if="item.owned" class="shopping-item__badge no-print">
                            {{ $t('ui:shopping.owned') }}
                        </span>
                    </li>
                </ul>
            </template>
        </div>
    `
};