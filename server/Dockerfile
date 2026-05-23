FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["./", "."]
RUN dotnet publish "api/api.csproj" \
    -c Release \
    -o /app/publish \
    --runtime linux-x64 \
    --self-contained true \
    /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    chromium \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgdk-pixbuf2.0-0 \
    libgbm-dev \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libasound2t64 \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
ENV PATH="/root/.local/bin:${PATH}"
RUN uv tool install playwright \
    && playwright install-deps chromium \
    && playwright install chromium
COPY --from=build /app/publish .
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV HOME=/root
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
ENV XDG_CACHE_HOME=/root/.cache
ENV XDG_CONFIG_HOME=/root/.config
ENV UV_LINK_MODE=copy
ENV DISPLAY=:99
EXPOSE 8080 6080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
