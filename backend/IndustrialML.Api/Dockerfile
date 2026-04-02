FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file first
COPY . .

# Restore dependencies
RUN dotnet restore "IndustrialML.Api.csproj"

# Build and publish
RUN dotnet publish "IndustrialML.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "IndustrialML.Api.dll"]

