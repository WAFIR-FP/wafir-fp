# compila o módulo C++ para WebAssembly com Emscripten
FROM emscripten/emsdk:5.0.2 AS cpp-builder

WORKDIR /app

COPY src/fingerprint/cpp/ ./src/fingerprint/cpp/

# ASYNCIFY permite aguardar a coleta assíncrona de áudio
RUN set -eu; \
    echo "==> [1/5] Preparando o diretorio de artefatos WebAssembly..."; \
    mkdir -p build; \
    echo "==> [2/5] Compilando os coletores C++ (Canvas, WebGL, audio e navegador)..."; \
    echo "    Emscripten: 5.0.2 | Asyncify: habilitado para a coleta assincrona de audio"; \
    em++ src/fingerprint/cpp/lib_fp.cpp \
        src/fingerprint/cpp/sha256.cpp \
        src/fingerprint/cpp/browser_fp.cpp \
        src/fingerprint/cpp/canva_fp.cpp \
        src/fingerprint/cpp/webgl_fp.cpp \
        src/fingerprint/cpp/audio_fp.cpp \
        src/fingerprint/cpp/fingerprint_processing.cpp \
        -sASYNCIFY \
        -sASYNCIFY_IMPORTS=get_audio_samples \
        -sEXPORTED_RUNTIME_METHODS='["callMain"]' \
        -o build/lib_fp.js; \
    echo "==> Compilacao WebAssembly concluida."; \
    echo "    Artefatos gerados:"; \
    ls -lh build/lib_fp.js build/lib_fp.wasm

FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN set -eu; \
    echo "==> [3/5] Instalando dependencias Node.js de producao com npm ci..."; \
    npm ci --omit=dev; \
    echo "==> Dependencias de producao instaladas com sucesso."

COPY . .

COPY --from=cpp-builder /app/build/ ./build/

RUN set -eu; \
    echo "==> [4/5] Verificando os arquivos da aplicacao e os artefatos WebAssembly..."; \
    test -f app.js; \
    test -f build/lib_fp.js; \
    test -f build/lib_fp.wasm; \
    echo "==> [5/5] Imagem preparada para iniciar o servidor Node.js."; \
    echo "    Porta HTTP interna: 3000"; \
    echo "    Comando de inicializacao: node app.js"

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "app.js"]
