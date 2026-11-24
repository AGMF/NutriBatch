import { createRouter, createWebHashHistory } from "vueRouter";
import RecipeSelectionView from "./views/RecipeSelectionView.js";

const routes = [
	{ path: "/", redirect: "/recipes" },
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

export default router;
