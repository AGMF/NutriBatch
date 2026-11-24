import { computed, ref } from "vue";
import ChainedBackend from "i18nextChainedBackend";
import HttpBackend from "i18nextHttpBackend";
import LanguageDetector from "i18nextLanguageDetector";
import LocalStorageBackend from "i18nextLocalstorageBackend";
import i18nextVue, { useTranslation } from "i18nextVue";
import i18next from "i18next";

const getLocalePath = (subpath) => `./src/locales/${subpath}.json`;

const createI18nConfig = (manifest) => ({
	ns: manifest.namespaces,
	fallbackLng: manifest.fallbackLng,
	supportedLngs: manifest.supportedLocales.toSorted(),
	cleanCode: true,
	interpolation: { escapeValue: false },
	backend: {
		backends: [LocalStorageBackend, HttpBackend],
		backendOptions: [
			{
				expirationTime: 7 * 24 * 60 * 60 * 1000,
				defaultVersion: manifest.defaultVersion,
				prefix: "i18n_res_",
			},
			{ loadPath: getLocalePath("{{lng}}/{{ns}}") },
		],
	},
	detection: {
		order: ["querystring", "localStorage", "navigator", "htmlTag"],
		caches: ["localStorage"],
		lookupLocalStorage: "i18nextLng",
	},
});

export const getSupportedLocales = () =>
	Array.isArray(i18next.options.supportedLngs)
		? i18next.options.supportedLngs.filter((lng) => lng !== "cimode")
		: [];

const updateDomAttributes = (lng) => {
	document.documentElement.lang = lng;
	const meta = document.querySelector("meta[name='description']");
	if (meta) meta.setAttribute("content", i18next.t("ui:app.description"));
};

const i18nVersion = ref(0);

const bumpI18n = () => i18nVersion.value++;

export const currentLocale = computed(() => {
	void i18nVersion.value;
	return i18next.resolvedLanguage;
});

export const t = (key, options) => {
	void i18nVersion.value;
	return i18next.t(key, options);
};

export const initI18n = async () => {
	const response = await fetch(getLocalePath("manifest"));
	const manifest = await response.json();

	await i18next
		.use(ChainedBackend)
		.use(LanguageDetector)
		.init(createI18nConfig(manifest));

	updateDomAttributes(i18next.resolvedLanguage);
	i18next.on("languageChanged", (lng) => {
		updateDomAttributes(lng);
		bumpI18n();
	});

	return i18next;
};

const createTranslatedComparator = (
	getKey,
	locale = i18next.resolvedLanguage,
) => {
	const collator = new Intl.Collator(locale);
	return (a, b) => collator.compare(i18next.t(getKey(a)), i18next.t(getKey(b)));
};

export const sortTranslated = (
	list,
	getKey,
	locale = i18next.resolvedLanguage,
) => {
	if (!Array.isArray(list)) return [];
	return list.toSorted(createTranslatedComparator(getKey, locale));
};

export { i18next, i18nextVue, useTranslation };
