const buildRecipeQueues = (recipes) =>
	recipes.map((recipe) => ({
		recipeId: recipe.id,
		nameKey: recipe.name_key,
		queue: [...(recipe.preparation_steps ?? [])]
			.sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))
			.map((step) => ({
				...step,
				recipeId: recipe.id,
				recipeNameKey: recipe.name_key,
			})),
	}));

const pickActiveStep = (queues, excludeRecipeId, budget) => {
	for (const q of queues) {
		if (q.recipeId === excludeRecipeId) continue;
		if (q.queue.length === 0) continue;

		const [next] = q.queue;
		if (!next.is_active) continue;

		const duration = next.duration_minutes ?? 0;
		if (duration > budget) continue;

		return { queue: q, step: next };
	}
	return null;
};

export const scheduleCooking = (recipes) => {
	if (!Array.isArray(recipes) || recipes.length === 0) return [];

	const queues = buildRecipeQueues(recipes);
	const blocks = [];
	let clock = 0;

	while (queues.some((q) => q.queue.length > 0)) {
		const passiveQueue = queues.find(
			(q) => q.queue.length > 0 && !q.queue[0].is_active,
		);

		if (passiveQueue) {
			const passiveStep = passiveQueue.queue.shift();
			const start = clock;
			const end = start + (passiveStep.duration_minutes ?? 0);
			const activeTasks = [];

			let remaining = end - start;
			while (remaining > 0) {
				const picked = pickActiveStep(queues, passiveQueue.recipeId, remaining);
				if (!picked) break;

				picked.queue.queue.shift();
				const duration = picked.step.duration_minutes ?? 0;
				activeTasks.push({
					...picked.step,
					start: clock,
					end: clock + duration,
				});
				clock += duration;
				remaining = end - clock;
			}

			clock = Math.max(clock, end);

			blocks.push({
				start,
				end: clock,
				passive: { ...passiveStep, start, end },
				active: activeTasks,
			});
		} else {
			const activeQueue = queues.find((q) => q.queue.length > 0);
			if (!activeQueue) break;

			const step = activeQueue.queue.shift();
			const duration = step.duration_minutes ?? 0;
			blocks.push({
				start: clock,
				end: clock + duration,
				passive: null,
				active: [{ ...step, start: clock, end: clock + duration }],
			});
			clock += duration;
		}
	}
	return blocks;
};

export const totalDuration = (blocks) =>
	Array.isArray(blocks) && blocks.length > 0
		? blocks[blocks.length - 1].end
		: 0;
