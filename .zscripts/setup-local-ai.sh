#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup script currently supports macOS. Install Ollama and whisper.cpp manually on other systems."
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it from https://brew.sh, then run this script again."
  exit 1
fi

if ! brew list --formula ollama >/dev/null 2>&1; then
  brew install ollama
fi
if ! brew list --formula whisper.cpp >/dev/null 2>&1; then
  brew install whisper.cpp
fi

brew services start ollama >/dev/null
for _ in {1..30}; do
  if curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null; then
    break
  fi
  sleep 1
done
if ! curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Ollama did not start. Open the Ollama app or run 'ollama serve', then retry."
  exit 1
fi

ollama pull "${OLLAMA_MODEL:-qwen2.5:3b}"

model_dir="$(cd "$(dirname "$0")/.." && pwd)/models"
mkdir -p "$model_dir"
whisper_model="$model_dir/ggml-small.bin"
if [[ ! -s "$whisper_model" ]]; then
  curl --location --fail --retry 3 --output "$whisper_model.tmp" \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
  mv "$whisper_model.tmp" "$whisper_model"
fi

echo "Local AI is ready. Ollama model: ${OLLAMA_MODEL:-qwen2.5:3b}; Whisper model: $whisper_model"
