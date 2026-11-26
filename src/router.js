import { createRouter, createWebHashHistory } from "vueRouter";
import { planner } from "./stores/planner.js";
import HomeView from "./views/HomeView.js";
import PlannerSetupView from "./views/PlannerSetupView.js";
import RecipeSelectionView from "./views/RecipeSelectionView.js";
import DietPlanView from "./views/DietPlanView.js";

const hasSetup = () =>
	planner.dailyKcal > 0 &&
	planner.selectedDays.length > 0 &&
	planner.meals.length > 0;

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
	{
		path: "/diet",
		name: "diet",
		component: DietPlanView,
		beforeEnter: () => {
			if (!hasSetup()) return { name: "planner" };
			if (planner.selectedRecipeIds.length === 0) return { name: "recipes" };
			return true;
		},
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
