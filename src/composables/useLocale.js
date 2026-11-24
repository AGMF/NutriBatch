import { computed, ref } from "vue";
import { getSupportedLocales, i18next } from "../i18n.js";
import { createDurationFormatter } from "../utils/recipes.js";

const localeVersion = ref(0);

const currentLocale = computed(() => {
    void localeVersion.value;
    return i18next.resolvedLanguage;
});

const durationFormatter = computed(() => createDurationFormatter(currentLocale.value));

const formatDuration = (totalMinutes) => durationFormatter.value(totalMinutes);

const setLocale = async (locale) => {
    await i18next.changeLanguage(locale);
    localeVersion.value++;
};

export function useLocale() {
    return {
        currentLocale,
        setLocale,
        formatDuration,
        getSupportedLocales
    };
}
