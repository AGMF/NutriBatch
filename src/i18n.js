import i18next from "i18next";
import ChainedBackend from "i18nextChainedBackend";
import LocalStorageBackend from "i18nextLocalstorageBackend";
import HttpBackend from "i18nextHttpBackend";
import LanguageDetector from "i18nextLanguageDetector";
import i18nextVue, { useTranslation } from "i18nextVue";

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
                        prefix: 'i18n_res_'
                    },
                    { loadPath: getLocalePath("{{lng}}/{{ns}}") }
                ]
            },
            detection: {
                order: ["querystring", "localStorage", "navigator", "htmlTag"],
                caches: ["localStorage"],
                lookupLocalStorage: "i18nextLng"
            }
        });

    document.documentElement.lang = i18next.resolvedLanguage;
    i18next.on("languageChanged", (lng) => document.documentElement.lang = lng);
    return i18next;
};

export { i18next, i18nextVue, useTranslation };
