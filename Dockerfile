# ---------- Сборка ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Subly.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish Subly.csproj -c Release -o /app --no-restore

# ---------- Запуск ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
# База и секретный ключ лежат в /data — на хостинге это постоянный диск, он не стирается при перезапуске
ENV ConnectionStrings__Default="Data Source=/data/subly.db"
# Хостинг передаёт порт в переменной PORT (см. Program.cs); локально — 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Subly.dll"]
