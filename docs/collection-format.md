# Formato da coleta, fallbacks e comparação

## Estrutura geral

As implementações JavaScript e C++/WebAssembly produzem a mesma estrutura lógica. Alguns campos internos de cada componente foram omitidos do exemplo:

```json
{
  "fingerprint_hash": "sha256",
  "canvas_fingerprint": {
    "hash": "sha256",
    "data_url": "data:image/png;base64,...",
    "available": true
  },
  "webgl_fingerprint": {
    "hash": "sha256",
    "available": true
  },
  "audio_fingerprint": {
    "hash": "sha256",
    "sample_rate": 44100,
    "fingerprint_value": 0,
    "sample_count": 5000,
    "available": true
  },
  "browser_fingerprint": {
    "hash": "sha256",
    "unavailable_fields": [],
    "available": true
  },
  "collector": "javascript",
  "collector_version": "1.2",
  "collection_status": {
    "canvas": { "status": "ok", "error_code": null },
    "webgl": { "status": "ok", "error_code": null },
    "audio": { "status": "ok", "error_code": null },
    "browser": {
      "status": "ok",
      "error_code": null,
      "unavailable_fields": []
    }
  }
}
```

`collector` vale `javascript` ou `cpp-wasm`. O campo `collector_version` versiona o comportamento de coleta e de fallback, não a versão do navegador.

## Campos comparados no artigo

O esquema experimental possui 52 campos destinados à comparação direta entre
as implementações. Hashes, indicadores de disponibilidade e metadados de
diagnóstico são adicionais e não entram nessa contagem.

| Categoria | Quantidade | Campos |
| --- | ---: | --- |
| Canvas | 1 | `data_url` |
| Áudio | 2 | `sample_rate`, `fingerprint_value` |
| WebGL | 11 | `vendor`, `version`, `renderer`, `extensions`, `render_hash`, `max_texture_size`, `vertex_precision`, `fragment_precision`, `max_viewport_width`, `max_viewport_height`, `shading_language_version` |
| Navegador e DOM | 38 | propriedades de `Navigator`, `Screen` e `Window`, além de suporte a armazenamento e APIs |
| **Total** | **52** | |

Os 38 nomes de navegador e DOM, na ordem lógica compartilhada pelos coletores,
são: `online`, `vendor`, `product`, `app_name`, `app_code_name`,
`app_version`, `language`, `languages`, `platform`, `timezone`,
`timezone_offset`, `user_agent`, `webdriver`, `indexed_db`, `local_storage`,
`session_storage`, `cookie_enabled`, `java_enabled`, `media_devices`,
`webgl_support`, `webgl2_support`, `canvas_support`, `fonts_available`,
`inner_width`, `inner_height`, `outer_width`, `outer_height`, `pixel_ratio`,
`product_sub`, `screen_width`, `screen_height`, `screen_avail_width`,
`screen_avail_height`, `screen_resolution`, `screen_color_depth`,
`screen_pixel_depth`, `max_touch_points` e `hardware_concurrency`.

## Estados e fallbacks

Os estados possíveis são:

| Estado | Significado |
| --- | --- |
| `ok` | Componente coletado integralmente |
| `partial` | Parte dos atributos foi coletada e parte foi descartada |
| `error` | O componente não pôde ser coletado |
| `unsupported` | A API necessária não está disponível no ambiente |

Os fallbacks são deliberadamente explícitos:

| Tipo ou componente | Fallback |
| --- | --- |
| Texto do navegador ou WebGL | `Unavailable` |
| Número de navegador indisponível | `-1` |
| Array indisponível | `[]` |
| Booleano indisponível | `false`, acompanhado pelo nome em `unavailable_fields` |
| Canvas indisponível | `data_url: "Unavailable"` e `available: false` |
| WebGL indisponível | textos `Unavailable`, números `0`, arrays vazios e `available: false` |
| Áudio indisponível | taxa e valor `0`, fingerprint numérico padronizado e `available: false` |
| Navegador indisponível por completo | `available: false` |

Um valor booleano `false` não significa automaticamente falha. Ele somente é descartado quando seu campo também consta em `unavailable_fields` ou quando o componente inteiro tem `available: false`.

Os códigos de diagnóstico atualmente emitidos incluem:

- Canvas: `CANVAS_CONTEXT_UNAVAILABLE` e `CANVAS_SERIALIZATION_FAILED`;
- WebGL: `WEBGL_CONTEXT_UNAVAILABLE`, `WEBGL_RENDER_FAILED` e `UNEXPECTED_COLLECTION_ERROR`;
- áudio: `AUDIO_CONTEXT_UNAVAILABLE`, `AUDIO_RENDER_FAILED`, `AUDIO_ASYNCIFY_UNAVAILABLE`, `AUDIO_SAMPLE_COUNT_INVALID` e `AUDIO_RESULT_INVALID`;
- navegador: `BROWSER_COLLECTION_UNAVAILABLE` e `BROWSER_FIELDS_UNAVAILABLE`.

## Áudio

Os dois coletores solicitam um `OfflineAudioContext` com taxa de 44,1 kHz e analisam as 5.000 amostras do buffer renderizado. A taxa efetiva registrada no JSON vem do `AudioBuffer` retornado pelo navegador. Se somente esse metadado não atravessar a ponte Asyncify, é mantida a taxa solicitada de 44,1 kHz. O componente fica disponível quando há exatamente 5.000 amostras e o resultado calculado é finito; a ausência isolada da taxa não descarta um fingerprint de áudio válido.

## Formação dos hashes

O projeto não aplica SHA-256 diretamente sobre o JSON final completo. Em vez disso:

1. Canvas usa a representação serializada da imagem.
2. WebGL usa uma composição em ordem fixa de versão, fabricante, renderizador, extensões, tamanho máximo de textura, viewport, precisão dos shaders de vértice e fragmento, versão da linguagem de shaders e resultado da renderização.
3. Áudio usa a representação decimal padronizada do valor calculado.
4. Navegador usa um objeto construído com campos e ordem explicitamente definidos pelos dois coletores; seu hash é exposto em `browser_fingerprint.hash`.
5. O hash final usa, nesta ordem, os hashes de Canvas, WebGL, áudio e navegador.

`available`, `unavailable_fields`, `collector`, `collector_version` e `collection_status` não entram no cálculo. Assim, a ordem das propriedades do JSON final não altera o hash. Uma coleta que recorre a fallback pode produzir um hash diferente de uma versão antiga, mas o componente passa a ser identificado como indisponível e não é usado como evidência pelo matcher.

### Relação com o experimento de 2026

Os resultados do artigo registraram divergências históricas causadas por
`browser.vendor` ausente (`Unknown` em um coletor e valor ausente no outro),
precisão textual de `devicePixelRatio`, fallback do WebGL, Canvas, áudio e
dimensões da janela. O contrato `1.2` uniformiza textos indisponíveis como
`Unavailable` e explicita disponibilidade e erros. Isso melhora a interpretação
de novas coletas, mas não recalcula retroativamente os 1.050 registros analisados
no artigo nem elimina, por si só, divergências de precisão numérica ou de
execução das APIs.

## Matcher, cobertura e limiares

Os pesos dos componentes são:

| Componente | Peso máximo |
| --- | ---: |
| Canvas | 0,25 |
| WebGL | 0,20 |
| Áudio | 0,10 |
| Navegador | 0,45 |

Componentes com `available: false` e campos presentes em `unavailable_fields` são excluídos. A similaridade é normalizada apenas pelo peso que pôde ser comparado; `coverage` informa a soma dos pesos realmente disponíveis. Uma decisão de mesma máquina exige cobertura mínima de `0,50`.

| Classificação | Similaridade |
| --- | ---: |
| Exata | 95% ou mais |
| Alta / mesma máquina | 85% ou mais |
| Média / provavelmente a mesma | 75% ou mais |
| Baixa / possivelmente a mesma | 65% ou mais |
| Diferente | Abaixo de 65% |

A resposta de comparação inclui os componentes excluídos e os estados de coleta de cada fingerprint. Os pesos e limiares são heurísticos e devem ser validados para a população e o protocolo experimental utilizados.
