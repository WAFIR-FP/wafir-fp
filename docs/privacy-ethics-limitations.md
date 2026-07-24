# Privacidade, ética e limitações

## Escopo

Esta ferramenta foi criada para pesquisa sobre web fingerprinting e comparação entre implementações JavaScript e WebAssembly. Ela não deve ser usada para rastreamento oculto, tomada de decisão automatizada sobre pessoas ou identificação individual sem base ética e autorização adequadas.

## Dados observados

A coleta pode incluir:

- representação de Canvas e características de renderização;
- fabricante, renderizador, extensões e capacidades WebGL;
- resultado de uma renderização de áudio offline;
- user agent, idioma, plataforma, fuso horário e dimensões de tela;
- suporte a armazenamento, cookies, mídia e APIs do navegador;
- hashes compostos e identificadores derivados desses sinais;
- horários de coleta e identificadores de sessão.

Mesmo quando armazenados como hash, esses valores podem permitir correlação entre sessões. Hash não equivale a anonimização.

## Limitações técnicas e científicas

- Um fingerprint representa um ambiente observado, não a identidade de uma pessoa.
- Atualizações de navegador, sistema, driver ou hardware podem alterar os sinais.
- Ambientes diferentes podem produzir valores semelhantes, gerando falsos positivos.
- O mesmo dispositivo pode produzir valores diferentes, gerando falsos negativos.
- Proteções do navegador, extensões, virtualização e configurações de privacidade afetam a coleta.
- Os pesos e limiares do matcher são heurísticos e precisam ser validados para cada população estudada.
- Um identificador de sessão derivado do hash é estável, mas aumenta o risco de vinculação entre coletas.
- Comparações de desempenho dependem de aquecimento, carga do sistema, navegador e ordem de execução.
- Resultados obtidos em um conjunto limitado de navegadores ou dispositivos não devem ser generalizados sem validação adicional.
- Componentes indisponíveis reduzem a cobertura da comparação; uma similaridade alta com cobertura baixa não comprova equivalência entre ambientes.
- Os códigos em `collection_status` ajudam a diagnosticar falhas técnicas, mas não permitem concluir por que uma API foi bloqueada ou alterada pelo navegador.
- Uma diferença em apenas um atributo altera o SHA-256 final; hashes divergentes
  não significam necessariamente ambientes materialmente diferentes.
- A execução sequencial pode observar estados diferentes de propriedades
  dinâmicas, como dimensões e orientação da janela.
- A implementação C++/Wasm depende de uma ponte JavaScript para acessar APIs
  Web; conversões nessa fronteira também podem introduzir divergências.