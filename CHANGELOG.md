# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## 1.0.0 (2026-10-28)


### Features

* estrutura inicial do projeto com Vue, Supabase e workflows de CI/CD ([aff3c68](https://github.com/AGMF/NutriBatch/commit/aff3c68bef96b67de9d6a5480849adf50003217d))

## [Unreleased]

### Adicionado
- Shell estático principal da aplicação `index.html` com Content Security Policy (CSP), meta tags de viewport e suporte a acessibilidade.
- Mapeamento de dependências via *Import Maps* para Vue 3 (v3.5.44) e Supabase JS Client (v2.118.0) via CDN jsDelivr com verificação de integridade de subrecurso (*Subresource Integrity* - SRI).
- Ponto de entrada JavaScript em `src/main.js` com estrutura do componente raiz e montagem no container `#app`.
- Folha de estilo global da aplicação em `css/main.css`.
- Workflows de automação e CI/CD para GitHub Actions em `.github/workflows/`:
    - `deploy.yml`: Implantação contínua (CD) no GitHub Pages a cada push na branch `main` ou disparo manual (*workflow_dispatch*).
    - `biome.yml`: Integração contínua (CI) para verificação de qualidade e linting de código com Biome em pushes e Pull Requests.
    - `release-please.yml`: Automação de versionamento semântico, geração de changelog e publicação de releases.
- Arquivos de governança e padronização do repositório: `.gitignore`, `.gitattributes`, `.nojekyll` e licença MIT (`LICENSE`).
