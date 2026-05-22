FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["./", "."]
RUN dotnet publish "api/api.csproj" \
    -c Release \
    -o /app/publish \
    --runtime linux-musl-x64 \
    --self-contained true \
    /p:PublishSingleFile=true

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0-alpine
WORKDIR /app
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    nss \
    gtk+3.0 \
    libxscrnsaver \
    alsa-lib \
    ttf-liberation \
    xdg-utils
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY --from=build /app/publish .
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV CAFE_SCOUT_BROWSER_BINARY=/usr/bin/chromium-browser
ENV UV_LINK_MODE=copy
ENV DISPLAY=:99
EXPOSE 8080 6080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
