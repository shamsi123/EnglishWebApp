# Builds one deployable: SERVICE=Learning | Progress | Gateway
ARG SERVICE=Learning

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG SERVICE
WORKDIR /src
COPY . .
RUN if [ "$SERVICE" = "Gateway" ]; then P=src/Gateway/EnglishPath.Gateway; else P=src/Services/$SERVICE/EnglishPath.$SERVICE.Api; fi \
    && dotnet publish "$P" -c Release -o /app --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
ARG SERVICE
ENV ASPNETCORE_HTTP_PORTS=8080 \
    APP_DLL=EnglishPath.${SERVICE}
WORKDIR /app
COPY --from=build /app .
USER app
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "if [ -f \"$APP_DLL.Api.dll\" ]; then exec dotnet \"$APP_DLL.Api.dll\"; else exec dotnet \"$APP_DLL.dll\"; fi"]
