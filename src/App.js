import { useLocale } from "./composables/useLocale.js";

export default {
	name: "App",
	setup() {
		const { currentLocale, setLocale, getSupportedLocales } = useLocale();
		return { currentLocale, setLocale, getSupportedLocales };
	},
	template: `
        <div class="app">
            <a class="skip-link" href="#main">{{ $t('ui:app.skip_link') }}</a>
            <header class="app-header">
                <h1 class="app-brand">
                    <router-link to="/" class="app-brand__link">NutriBatch</router-link>
                </h1>
                <nav class="locale-switcher" :aria-label="$t('ui:app.language_switcher')">
                    <button
                        v-for="locale in getSupportedLocales()"
                        :key="locale"
                        class="locale-btn"
                        type="button"
                        :disabled="currentLocale === locale"
                        :aria-current="currentLocale === locale ? 'true' : undefined"
                        @click="setLocale(locale)">{{ locale }}</button>
                </nav>
            </header>

            <main id="main" class="app-main" tabindex="-1">
                <router-view></router-view>
            </main>

            <footer class="app-footer">
                <small>{{ $t('ui:app.legal') }}</small>
            </footer>
        </div>
    `,
};
