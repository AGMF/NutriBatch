import { createRouter, createWebHashHistory } from "vueRouter";
import HomeView from "./views/HomeView.js";
import PlannerSetupView from "./views/PlannerSetupView.js";
import RecipeSelectionView from "./views/RecipeSelectionView.js";

const routes = [
	{
		path: "/",
		name: "home",
		component: HomeView,
	},
	{
		path: "/planner",
		name: "planner",
		component: PlannerSetupView,
	},
	{
		path: "/recipes",
		name: "recipes",
		component: RecipeSelectionView,
	},
];

const router = createRouter({
	history: createWebHashHistory(),
	routes,
	scrollBehavior(_to, _from, savedPosition) {
		if (savedPosition) return savedPosition;
		return { top: 0 };
	},
});

router.beforeResolve(async (to, from) => {
	if (!from.name || to.name === from.name) return;
	await new Promise((resolve) => document.startViewTransition(resolve));
});

export default router;
