# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
