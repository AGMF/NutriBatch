# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## 0.1.0 (2026-11-26)


### Features

* adiciona agendador de preparo e agregador de compras ([34a3e06](https://github.com/AGMF/NutriBatch/commit/34a3e06f99c7d7e4945075875755f7614dc98a0b))
* adiciona algoritmo de montagem de dieta ([7f90fcc](https://github.com/AGMF/NutriBatch/commit/7f90fcc58c0bd0ecf18e4c24af903cc05bfb37ba))
* adiciona estilização completa com classes BEM ([fc4f7b9](https://github.com/AGMF/NutriBatch/commit/fc4f7b9cc9abeffc6878b2e7194026d9f04dc49f))
* adiciona exportação por impressão/PDF e links de navegação ([4214251](https://github.com/AGMF/NutriBatch/commit/4214251551aab650d1c2c0a45726aea20aa8a5ad))
* adiciona lista de compras com checkbox "já tenho" ([9d11438](https://github.com/AGMF/NutriBatch/commit/9d11438aa822cdd0205f9f420c1b2d1b70bd9812))
* adiciona modo de preparo imersivo ([f043d1c](https://github.com/AGMF/NutriBatch/commit/f043d1cec89b51b8461168a4c1729112336eccfb))
* adiciona página inicial com CTA de planejamento ([99443a1](https://github.com/AGMF/NutriBatch/commit/99443a169bd2384cd07f182e5bb309225fa3adf2))
* adiciona receitas de arroz de couve-flor, feijão carioca e frango grelhado ([d096df2](https://github.com/AGMF/NutriBatch/commit/d096df27e9c400c026a21b6cbad185aca0a7089e))
* adiciona seleção de receitas com barra de ação fixa ([bd1caa2](https://github.com/AGMF/NutriBatch/commit/bd1caa29de40b3545f72089fa870fef89c61b7c8))
* adiciona store de planejamento e tela de configuração de metas ([8522021](https://github.com/AGMF/NutriBatch/commit/85220215264f96718f756a3cfc6f2f944a5bc0ae))
* adiciona variação aleatória de matiz ao gradiente ([d567b4c](https://github.com/AGMF/NutriBatch/commit/d567b4c8767aeec44a769c2a30f5186eba2ed06a))
* adicionar chave de unidade de calorias ([fdaa1c7](https://github.com/AGMF/NutriBatch/commit/fdaa1c7bdcfaed1e30d1696d50cd058aa40bab52))
* adicionar exibição detalhada de receitas, cálculo nutricional, passos de preparo e suporte estendido a i18n ([fc86a42](https://github.com/AGMF/NutriBatch/commit/fc86a42cf734c6be06e5bd999332cd86a142f368))
* ajustar traduções, adicionar chaves de restrições alimentares e atualizar tags de alergênicos ([b6be47c](https://github.com/AGMF/NutriBatch/commit/b6be47c37293604f3ba451ea2a12c22c637beb4c))
* atualizar meta description dinamicamente ao alterar idioma e ajustar sincronizacao do resolvedLanguage ([128000a](https://github.com/AGMF/NutriBatch/commit/128000a98c6d7ba3e92b30749a37bf282d28e348))
* estrutura inicial do projeto com Vue, Supabase e workflows de CI/CD ([aff3c68](https://github.com/AGMF/NutriBatch/commit/aff3c68bef96b67de9d6a5480849adf50003217d))
* exibe o plano de dieta gerado ([977c874](https://github.com/AGMF/NutriBatch/commit/977c874ccafab3b23a503c821d74b533544c442f))
* implementar filtro tri-state para categorias com suporte a exclusão e debounce ([8bb61dc](https://github.com/AGMF/NutriBatch/commit/8bb61dc9e84433990324edde06d6cae5234d8670))
* implementar internacionalização, interface reativa e rolagem infinita ([7957f15](https://github.com/AGMF/NutriBatch/commit/7957f15b01c833cfe584ddb44e6d08740ce21d93))
* integra View Transitions API nas navegações ([324903b](https://github.com/AGMF/NutriBatch/commit/324903b79aae16d393549e5e62ebc172def4a4de))
* introduz Vue Router e reorganiza app em views ([27c7827](https://github.com/AGMF/NutriBatch/commit/27c7827bd547f5c495000e82ff7d05f17d3c250b))


### Bug Fixes

* ajusta semântica do botao tri-state utilizando aria-pressed ([63ac3b7](https://github.com/AGMF/NutriBatch/commit/63ac3b77c2bf17aa615ec60ad0932182bdc0f57b))
* corrige chave `include` para `includes` no overrides da config ([bbb9723](https://github.com/AGMF/NutriBatch/commit/bbb97234f5a4ed26cd217e0ce5147b130cae41ea))
* corrige especificidade descendente e propriedades duplicadas ([ad7f5c8](https://github.com/AGMF/NutriBatch/commit/ad7f5c8f46a0fab45f5f51d8395c5bba1156ea02))
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
