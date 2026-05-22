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
RUN apk add --no-cache ca-certificates chromium
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV CAFE_SCOUT_BROWSER_BINARY=/usr/bin/chromium-browser
ENV UV_LINK_MODE=copy
EXPOSE 8080

ENTRYPOINT ["./api"]
