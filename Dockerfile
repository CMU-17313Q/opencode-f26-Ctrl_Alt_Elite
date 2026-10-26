FROM oven/bun:1.3.14

RUN apt-get update && apt-get install -y \
    git ca-certificates python3 build-essential ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HUSKY=0

COPY . .
RUN bun install

EXPOSE 4096
CMD ["bun", "run", "--cwd", "packages/opencode", "--conditions=browser", "src/index.ts", "web", "--hostname", "0.0.0.0", "--port", "4096"]
