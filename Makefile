.PHONY: dev setup test test-cpp test-node

dev: setup
	em++ src/fingerprint/cpp/lib_fp.cpp src/fingerprint/cpp/sha256.cpp src/fingerprint/cpp/browser_fp.cpp src/fingerprint/cpp/canva_fp.cpp src/fingerprint/cpp/webgl_fp.cpp src/fingerprint/cpp/audio_fp.cpp src/fingerprint/cpp/fingerprint_processing.cpp -sASYNCIFY -sASYNCIFY_IMPORTS=get_audio_samples -sEXPORTED_RUNTIME_METHODS='["callMain"]' -o build/lib_fp.js

test: test-cpp test-node
	@echo ""
	@echo "Todos os testes foram concluídos com sucesso."

test-cpp: setup
	@echo ""
	@echo "Executando testes do processamento C++..."
	@mkdir -p build/tests
	@$(CXX) -std=c++17 -Wall -Wextra -pedantic -Isrc/fingerprint/cpp tests/fingerprint_processing_test.cpp src/fingerprint/cpp/fingerprint_processing.cpp -o build/tests/fingerprint_processing_test
	@./build/tests/fingerprint_processing_test

test-node:
	@echo ""
	@echo "Executando testes da aplicação Node.js..."
	@node --test --test-isolation=none --test-reporter=./tests/reporter-pt.js tests/*.test.js

setup:
	@mkdir -p build
