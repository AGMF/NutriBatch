import { createApp, ref, watch, onMounted, onUnmounted } from "vue";
import { createClient } from "supabase";
import { initI18n, i18next, i18nextVue, useTranslation, getSupportedLocales } from "./i18n.js";

const SUPABASE_URL = "https://ecwvgqzzmxnngfhjlejk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1uOWx-SNjBrH1ZZSexaLUA_INC5yBQc";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PAGE_SIZE = 10;

(async () => {
    await initI18n();

    const app = createApp({
        setup() {
            const { i18next: i18n } = useTranslation();
            const currentLocale = ref(i18n.language);

            const setLocale = async (locale) => {
                await i18n.changeLanguage(locale);
                currentLocale.value = i18n.language;
            };

            const items = ref([]);
            const categories = ref([]);
            const selectedCategoryIds = ref([]);

            const page = ref(0);
            const hasMore = ref(true);
            const totalCount = ref(null);

            const loading = ref(false);
            const loadingCategories = ref(true);
            const errorMessage = ref(null);

            const sentinel = ref(null);
            let observer = null;

            const fetchCategories = async () => {
                try {
                    loadingCategories.value = true;
                    const { data, error } = await supabase
                        .from("categories")
                        .select("id, code_key")
                        .order("code_key", { ascending: true });

                    if (error) throw error;
                    categories.value = data || [];
                }catch (err) {
                    errorMessage.value = err.message;
                } finally {
                    loadingCategories.value = false;
                }
            };

            const fetchItems = async (isReset = false) => {
                if (loading.value || (!hasMore.value && !isReset)) return;

                loading.value = true;
                errorMessage.value = null;

                const targetPage = isReset ? 0 : page.value;
                const from = targetPage * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                try {
                    const hasCategoryFilter = selectedCategoryIds.value.length > 0;

                    // 1. Sempre selecionamos todas as categorias da receita via `recipe_categories`
                    // 2. Se houver filtro, adicionamos um alias `recipe_categories_filter` com !inner apenas para aplicar o filtro nas receitas
                    let selectClause = `
                        id,
                        name_key,
                        description_key,
                        yield_factor,
                        created_at,
                        recipe_categories(category_id, categories(id, code_key))
                    `;

                    if (hasCategoryFilter) selectClause += `, recipe_categories_filter:recipe_categories!inner(category_id)`;

                    let query = supabase
                        .from("recipes")
                        .select(selectClause, { count: "exact" })
                        .range(from, to)
                        .order("created_at", { ascending: false });

                    if (hasCategoryFilter) query = query = query.in("recipe_categories_filter.category_id", selectedCategoryIds.value);

                    const { data, error, count } = await query;

                    if (error) throw error;

                    const formattedData = (data || []).map(recipe => {
                        if (recipe.recipe_categories && Array.isArray(recipe.recipe_categories))
                            recipe.recipe_categories.sort((a, b) => (a.categories?.code_key || "").localeCompare(b.categories?.code_key || ""));
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
                    hasMore.value = items.value.length < count && formattedData.length === PAGE_SIZE;
                } catch (err) {
                    errorMessage.value = err.message || "Erro ao conectar ao banco.";
                } finally {
                    loading.value = false;
                }
            };

            const toggleCategoryFilter = (categoryId) => {
                if (!categoryId) return;
                const index = selectedCategoryIds.value.indexOf(categoryId);
                if (index > -1) selectedCategoryIds.value.splice(index, 1);
                else selectedCategoryIds.value.push(categoryId);
            };

            const resetAndFetch = () => fetchItems(true);

            const clearFilters = () => selectedCategoryIds.value = [];

            watch(selectedCategoryIds, () => resetAndFetch(), { deep: true });

            const setupIntersectionObserver = () => {
                observer = new IntersectionObserver((entries) => {
                    const [entry] = entries;
                    if (entry.isIntersecting && hasMore.value && !loading.value) fetchItems();
                }, { root: null, rootMargin: "200px", threshold: 0.1 });

                if (sentinel.value) observer.observe(sentinel.value);
            };

            onMounted(() => {
                fetchCategories();
                fetchItems(true);
                setupIntersectionObserver();
            });

            onUnmounted(() => {
                if (observer && sentinel.value) observer.unobserve(sentinel.value);
            });

            return {
                currentLocale,
                setLocale,
                getSupportedLocales,
                items,
                categories,
                selectedCategoryIds,
                loading,
                loadingCategories,
                errorMessage,
                hasMore,
                totalCount,
                sentinel,
                clearFilters,
                resetAndFetch,
                toggleCategoryFilter
            };
        }
    });

    app.use(i18nextVue, { i18next });
    app.mount("#app");
})();
