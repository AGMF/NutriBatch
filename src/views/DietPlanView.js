export default {
    name: "DietPlanView",
    template: `
        <div class="diet-page">
            <section class="diet-page__placeholder" aria-labelledby="diet-stub-title">
                <h2 id="diet-stub-title" class="section-title">{{ $t('ui:diet.title') }}</h2>
                <p class="status" role="status" aria-busy="true">
                    {{ $t('ui:diet.building') }}
                </p>
                <router-link to="/recipes" class="btn btn--ghost">
                    {{ $t('ui:diet.back') }}
                </router-link>
            </section>
        </div>
    `
};
