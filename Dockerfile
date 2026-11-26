# 1. Start with an image that has Bun installed
FROM oven/bun:1

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy project files into the container
COPY . .

# 4. Install project dependencies
RUN bun install --frozen-lockfile

# 5. Document the ports used by the application
EXPOSE 5173 8787

# 6. Build the project and start the development servers
CMD ["sh", "-c", "bun run build && bun run dev"]
