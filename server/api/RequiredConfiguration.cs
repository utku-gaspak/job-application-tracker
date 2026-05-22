namespace api;

public static class RequiredConfiguration
{
    // Centralize required startup config checks so they stay testable outside Program.cs bootstrapping.
    public static string GetDefaultConnection(IConfiguration configuration)
    {
        var defaultConnection = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(defaultConnection))
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured."
            );

        return defaultConnection;
    }

    public static string GetScraperRootDirectory(IConfiguration configuration) =>
        GetOptionalValue(configuration, "Scraper:RootDirectory", "/root/code/hiring-cafe-scout");

    public static string GetScraperRunsDirectory(IConfiguration configuration) =>
        GetOptionalValue(configuration, "Scraper:RunsDirectory", "/srv/hiring-cafe/runs");

    public static string GetScraperProfilesDirectory(IConfiguration configuration) =>
        GetOptionalValue(
            configuration,
            "Scraper:ProfilesDirectory",
            "/srv/hiring-cafe/browser-profiles"
        );

    public static string GetScraperDataDirectory(IConfiguration configuration) =>
        GetOptionalValue(configuration, "Scraper:DataDirectory", "/srv/hiring-cafe/data");

    private static string GetOptionalValue(
        IConfiguration configuration,
        string key,
        string fallback
    ) =>
        string.IsNullOrWhiteSpace(configuration[key]) ? fallback : configuration[key]!;
}
