import { computed } from "vue";
import { currentLocale, getSupportedLocales, i18next } from "../i18n.js";
import { createDurationFormatter } from "../utils/recipes.js";

const durationFormatter = computed(() =>
	createDurationFormatter(currentLocale.value),
);

const formatDuration = (totalMinutes) => durationFormatter.value(totalMinutes);

const setLocale = async (locale) => await i18next.changeLanguage(locale);

export function useLocale() {
	return {
		currentLocale,
		setLocale,
		formatDuration,
		getSupportedLocales,
	};
}
