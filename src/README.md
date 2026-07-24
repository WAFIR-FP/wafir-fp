# Componentes Principais

## Controllers

Recebem as requisições das rotas, coordenam os serviços necessários e retornam respostas para o cliente. Cada controlador concentra uma área da aplicação: páginas, administração, coleta de fingerprint e health check.

## Services

Reúnem a lógica de negócio e as operações de dados. São responsáveis por processar fingerprints, salvar logs, consultar estatísticas e gerenciar sessões administrativas.

## Middleware

Executam verificações antes das requisições chegarem aos controladores. A aplicação utiliza middlewares para autenticação administrativa, cabeçalhos de segurança e limitação de requisições.

## Routes

Definem os endpoints da aplicação e conectam cada rota ao controlador correspondente. O arquivo `routes/index.js` centraliza o agrupamento das rotas.

## Fingerprint

Contém os módulos responsáveis pela coleta de características do navegador e do
dispositivo. A aplicação possui uma implementação de referência em JavaScript e
outra em C++ compilado para WebAssembly com Emscripten.

O coletor C++/Wasm é híbrido: pontes `EM_JS` acessam Canvas, WebGL, Web Audio e
objetos do navegador; o módulo C++ coordena o processamento, a normalização, os
hashes e a saída. Os coletores produzem 52 campos comparáveis (38 de navegador
e DOM, 11 de WebGL, 2 de áudio e 1 de Canvas), além de hashes e diagnósticos.

O formato compartilhado, os fallbacks e a formação dos hashes estão descritos em [`docs/collection-format.md`](../docs/collection-format.md).

## Views

Armazena os templates HTML renderizados no servidor. O arquivo `view.engine.js` implementa um mecanismo simples de substituição de variáveis nos templates.

## Assets

Contém imagens, favicon e manifesto da aplicação.

## Documentação de pesquisa

A arquitetura e as considerações de privacidade ficam separadas do código em [`docs/`](../docs/README.md).
