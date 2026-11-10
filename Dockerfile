FROM oven/bun:1.3.14

RUN apt-get update && apt-get install -y \
    git ca-certificates python3 build-essential ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HUSKY=0

COPY . .
RUN bun install

# Build a single native binary with our packages/app frontend embedded. Without the embedded
# bundle, `opencode web` proxies the UI from the upstream app.opencode.ai, which lacks our features.
# Channel and version are set explicitly because .git is excluded from the build context.
ENV OPENCODE_CHANNEL=vm OPENCODE_VERSION=0.0.0-vm
RUN cd packages/opencode \
    && bun run script/build.ts --single \
    && cp dist/opencode-linux-*/bin/opencode /usr/local/bin/opencode

EXPOSE 4096
CMD ["opencode", "web", "--hostname", "0.0.0.0", "--port", "4096"]
