FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates cmake g++ git make ffmpeg python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --break-system-packages --no-cache-dir yt-dlp
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git /tmp/whisper.cpp \
    && cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON \
    && cmake --build /tmp/whisper.cpp/build --config Release -j2 \
    && cp /tmp/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli \
    && rm -rf /tmp/whisper.cpp
RUN mkdir -p /models \
    && curl --location --fail --retry 3 --output /models/ggml-small.bin \
       https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

WORKDIR /app
COPY worker/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY worker/server.mjs ./server.mjs
ENV PORT=8080 WHISPER_MODEL_PATH=/models/ggml-small.bin
EXPOSE 8080
CMD ["node", "server.mjs"]
