# Experimento aberto de 2026

## Escopo

- Período de coleta: 24 de abril a 1º de maio de 2026.
- Desenho: convite aberto por e-mail e redes sociais.
- Unidade observada: sessão de navegação que executa, sequencialmente, o coletor
  C++/WebAssembly e depois o coletor JavaScript.
- Campos comparados por sessão: 52 — 38 de navegador e DOM, 11 de WebGL, 2 de
  áudio e 1 de Canvas.
- Critério de exclusão relatado: mais da metade dos atributos ausentes.

O estudo avaliou reprodutibilidade entre implementações. Não avaliou
desempenho, uso de memória, latência de inicialização, estabilidade longitudinal
ou discrição frente a ferramentas anti-fingerprinting.

## Amostra

| Estado | Sessões |
| --- | ---: |
| Coletas recebidas | 1.054 |
| Excluídas por informação incompleta | 4 |
| Válidas para comparação | 1.050 |

Caracterização das 1.054 coletas recebidas:

| Dimensão | Distribuição |
| --- | --- |
| Dispositivo | 651 smartphones (61,8%); 396 desktops/notebooks (37,6%); 7 tablets (0,7%) |
| Sistema operacional | 503 Android (47,7%); 294 Windows (27,9%); 143 iOS (13,6%); 82 Linux (7,8%); 32 macOS (3,0%) |
| Navegador | 624 Chrome (59,2%); 139 Firefox (13,2%); 124 Safari (11,8%); 89 Samsung Internet (8,4%); 63 Edge (6,0%); 15 Opera (1,4%) |

## Equivalência observada

| Nível de comparação | Iguais | Divergentes |
| --- | ---: | ---: |
| Hash final por sessão | 802 de 1.050 (76,38%) | 248 de 1.050 (23,62%) |
| Atributo individual | 54.316 de 54.600 (99,48%) | 284 de 54.600 (0,52%) |

Os dois percentuais não são contraditórios. O hash final é formado a partir dos
hashes dos quatro componentes; uma única diferença entre os 52 atributos pode
alterá-lo completamente.

## Categorias de divergência

| Categoria | Sessões | % das 248 divergentes | % das 1.050 válidas |
| --- | ---: | ---: | ---: |
| `browser.vendor` ausente | 136 | 54,84% | 12,95% |
| `devicePixelRatio` / `pixel_ratio` | 71 | 28,63% | 6,76% |
| Canvas | 26 | 10,48% | 2,48% |
| Dimensões da janela | 17 | 6,85% | 1,62% |
| Áudio | 16 | 6,45% | 1,52% |
| WebGL | 1 | 0,40% | 0,10% |

As categorias não são mutuamente exclusivas. Entre as 248 sessões com hash
final divergente, 230 diferiram em uma categoria, 17 em duas e uma em três.

- Em 136 sessões, ausência de `browser.vendor` foi representada de maneiras
  diferentes (`Unknown` no coletor C++/Wasm e valor ausente no JavaScript).
- Em 71, `devicePixelRatio` representou a mesma grandeza com quantidades
  diferentes de casas decimais.
- As 26 diferenças de Canvas produziram `data_url` e hash distintos, mas os
  dados registrados não permitem isolar rasterização, fonte, ordem de desenho
  ou serialização.
- As 17 diferenças de dimensão podem refletir mudança do estado visual entre as
  duas execuções sequenciais; o experimento não registrou eventos suficientes
  para estabelecer causalidade.
- As 16 diferenças de áudio se concentraram no valor processado, mas a entrada
  textual de doze casas usada pelo hash não foi persistida.
- A única ocorrência de WebGL usou fallbacks no coletor C++/Wasm e dados
  completos no JavaScript; ela também divergiu em Canvas e áudio.

## Interpretação e rastreabilidade

Os resultados sustentam a viabilidade do C++/WebAssembly para reproduzir a
maior parte dos atributos, mas também mostram que igualdade de hash não deve ser
usada isoladamente como evidência de equivalência semântica. Valores ausentes,
precisão decimal, estado dinâmico do navegador e políticas de fallback precisam
ser normalizados e diagnosticados antes da geração do identificador.
