import ChainedBackend from "i18nextChainedBackend";
import HttpBackend from "i18nextHttpBackend";
import LanguageDetector from "i18nextLanguageDetector";
import LocalStorageBackend from "i18nextLocalstorageBackend";
import i18nextVue, { useTranslation } from "i18nextVue";
import i18next from "i18next";

let supportedLocales = [];
export const getSupportedLocales = () => [...supportedLocales];

const getLocalePath = (subpath) => `./src/locales/${subpath}.json`;

export const initI18n = async () => {
	const response = await fetch(getLocalePath("manifest"));
	const manifest = await response.json();

	supportedLocales = manifest.supportedLocales;

	await i18next
		.use(ChainedBackend)
		.use(LanguageDetector)
		.init({
			ns: manifest.namespaces,
			fallbackLng: manifest.fallbackLng,
			supportedLngs: supportedLocales,
			cleanCode: true,
			interpolation: { escapeValue: false },
			backend: {
				backends: [LocalStorageBackend, HttpBackend],
				backendOptions: [
					{
						expirationTime: 7 * 24 * 60 * 60 * 1000, // 7 dias
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

	document.documentElement.lang = i18next.resolvedLanguage;
	const meta = document.querySelector("meta[name='description']");
	i18next.on("languageChanged", (lng) => {
		document.documentElement.lang = lng;
		meta.setAttribute("content", i18next.t("ui:app.description"));
	});

	return i18next;
};

export { i18next, i18nextVue, useTranslation };
