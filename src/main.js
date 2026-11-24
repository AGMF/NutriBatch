import { createApp } from "vue";
import App from "./App.js";
import { i18next, i18nextVue, initI18n } from "./i18n.js";
import router from "./router.js";

(async () => {
	await initI18n();

	const app = createApp(App);
	app.use(router);
	app.use(i18nextVue, { i18next });
	app.mount("#app");
})();
