# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## 0.1.0 (2026-11-10)


### Features

* adicionar exibição detalhada de receitas, cálculo nutricional, passos de preparo e suporte estendido a i18n ([fc86a42](https://github.com/AGMF/NutriBatch/commit/fc86a42cf734c6be06e5bd999332cd86a142f368))
* ajustar traduções, adicionar chaves de restrições alimentares e atualizar tags de alergênicos ([b6be47c](https://github.com/AGMF/NutriBatch/commit/b6be47c37293604f3ba451ea2a12c22c637beb4c))
* atualizar meta description dinamicamente ao alterar idioma e ajustar sincronizacao do resolvedLanguage ([128000a](https://github.com/AGMF/NutriBatch/commit/128000a98c6d7ba3e92b30749a37bf282d28e348))
* estrutura inicial do projeto com Vue, Supabase e workflows de CI/CD ([aff3c68](https://github.com/AGMF/NutriBatch/commit/aff3c68bef96b67de9d6a5480849adf50003217d))
* implementar filtro tri-state para categorias com suporte a exclusão e debounce ([8bb61dc](https://github.com/AGMF/NutriBatch/commit/8bb61dc9e84433990324edde06d6cae5234d8670))
* implementar internacionalização, interface reativa e rolagem infinita ([7957f15](https://github.com/AGMF/NutriBatch/commit/7957f15b01c833cfe584ddb44e6d08740ce21d93))


### Bug Fixes

* ajusta semântica do botao tri-state utilizando aria-pressed ([63ac3b7](https://github.com/AGMF/NutriBatch/commit/63ac3b77c2bf17aa615ec60ad0932182bdc0f57b))
* corrigir acessibilidade no index.html e regra CSS do v-cloak ([c2ac14b](https://github.com/AGMF/NutriBatch/commit/c2ac14b3e7d9c51742883a2ee5c362d2cee3bd50))
* permitir unsafe-eval em script-src para compilacao de templates do Vue ([316b630](https://github.com/AGMF/NutriBatch/commit/316b63095d8834076a5998aa03eb42c6e1110111))


### Performance Improvements

* otimizar reatividade com shallowRef e useTemplateRef; simplificar ordenação de categorias com lodash-es ([4a13520](https://github.com/AGMF/NutriBatch/commit/4a135202bac0e3da79d3a08da79c4a402719762e))

## [Unreleased]

### Adicionado

- Shell estático principal `index.html` configurado com Content Security Policy (CSP), meta tags de viewport, diretiva `v-cloak` e estrutura reativa (cabeçalho para alternância de idioma, painel de filtros, cards de receitas e sentinela para rolagem infinita).
- Mapeamento de dependências via _Import Maps_ e `modulepreload` com verificação de integridade de subrecurso (SRI) no `index.html` para Vue 3 (v3.5.44), Supabase JS Client ESM (v2.118.0) e ecossistema i18next.
- Módulo de internacionalização (i18n) em `src/i18n.js` com `i18next`, suporte a múltiplos backends (`LocalStorageBackend` e `HttpBackend`), detecção de idioma e integração reativa com Vue 3 via `i18nextVue`.
- Estrutura de arquivos de tradução em `src/locales/` para os idiomas `pt-BR` e `en-US` divididos nos namespaces `categories`, `recipes` e `ui`, com arquivo de manifesto `manifest.json`.
- Ponto de entrada JavaScript em `src/main.js` integrando Vue 3, Supabase e i18n, responsável por consultas relacionais de receitas filtradas por categoria, paginação e observador de interseção (`IntersectionObserver`).
- Estilo global em `css/main.css` contendo regra para prevenção de _Flash of Unstyled Content_ (FOUC).
- Workflow unificado de CI/CD para GitHub Actions em `.github/workflows/pipeline.yml` consolidando tarefas de linting/auto-formatação com Biome (com auto-commit), implantação no GitHub Pages e publicação de lançamentos via Release Please.
- Arquivos de governança e padronização do repositório: `.gitignore`, `.gitattributes` e licença MIT (`LICENSE`).
