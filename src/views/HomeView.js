export default {
    name: "HomeView",
    setup() {
        const features = [
            {
                key: "goals",
                icon: `
                    <circle cx="12" cy="12" r="9"/>
                    <circle cx="12" cy="12" r="5"/>
                    <circle cx="12" cy="12" r="1.5"/>
                `,
            },
            {
                key: "balance",
                icon: `
                    <path d="M12 3v18"/>
                    <path d="M5 8h14"/>
                    <path d="M5 8l-3 6a3 3 0 0 0 6 0z"/>
                    <path d="M19 8l-3 6a3 3 0 0 0 6 0z"/>
                `,
            },
            {
                key: "flexibility",
                icon: `
                    <rect x="3" y="5" width="18" height="16" rx="2"/>
                    <path d="M3 10h18"/>
                    <path d="M8 3v4"/>
                    <path d="M16 3v4"/>
                `,
            },
        ];

        const steps = [
            { key: "define" },
            { key: "select" },
            { key: "plan" },
        ];

        return { features, steps };
    },
    template: `
        <div class="home">
            <section class="hero" aria-labelledby="hero-title">
                <p class="hero__eyebrow">{{ $t('ui:home.eyebrow') }}</p>
                <h2 id="hero-title" class="hero__title">{{ $t('ui:home.title') }}</h2>
                <p class="hero__subtitle">{{ $t('ui:home.subtitle') }}</p>
                <div class="hero__actions">
                    <router-link to="/planner" class="btn btn--primary btn--lg">
                        <span>{{ $t('ui:home.cta') }}</span>
                        <span aria-hidden="true">→</span>
                    </router-link>
                    <router-link to="/recipes" class="btn btn--ghost">
                        {{ $t('ui:home.secondary_cta') }}
                    </router-link>
                </div>
            </section>

            <section class="features" aria-labelledby="features-title">
                <h2 id="features-title" class="section-title">{{ $t('ui:home.features_title') }}</h2>
                <ul class="features__grid">
                    <li v-for="feature in features" :key="feature.key" class="feature">
                        <span class="feature__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="feature.icon"></svg>
                        </span>
                        <h3 class="feature__title">{{ $t('ui:home.features.' + feature.key + '.title') }}</h3>
                        <p class="feature__body">{{ $t('ui:home.features.' + feature.key + '.body') }}</p>
                    </li>
                </ul>
            </section>

            <section class="how" aria-labelledby="how-title">
                <h2 id="how-title" class="section-title">{{ $t('ui:home.how_title') }}</h2>
                <ol class="how__steps">
                    <li v-for="(step, index) in steps" :key="step.key" class="how__step">
                        <span class="how__step-number" aria-hidden="true">{{ index + 1 }}</span>
                        <div>
                            <h3 class="how__step-title">{{ $t('ui:home.steps.' + step.key + '.title') }}</h3>
                            <p class="how__step-body">{{ $t('ui:home.steps.' + step.key + '.body') }}</p>
                        </div>
                    </li>
                </ol>
            </section>
        </div>
    `
};