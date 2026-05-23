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

    public static string GetScraperBrowserBinary()
    {
        var configured = Environment.GetEnvironmentVariable("CAFE_SCOUT_BROWSER_BINARY");
        if (TryResolveExecutable(configured, out var resolvedConfigured))
        {
            return resolvedConfigured;
        }

        foreach (var candidate in GetPlaywrightChromiumCandidates().Concat(new[]
                 {
                     "/usr/bin/google-chrome",
                     "/usr/bin/google-chrome-stable",
                     "/usr/bin/chromium",
                     "/usr/bin/chromium-browser",
                     "google-chrome",
                     "google-chrome-stable",
                     "chromium",
                     "chromium-browser",
                 }))
        {
            if (TryResolveExecutable(candidate, out var resolvedCandidate))
            {
                return resolvedCandidate;
            }
        }

        return "/usr/bin/chromium";
    }

    private static IEnumerable<string> GetPlaywrightChromiumCandidates()
    {
        var roots = new[]
        {
            Environment.GetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH"),
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".cache",
                "ms-playwright"
            ),
            "/root/.cache/ms-playwright",
        };

        foreach (var root in roots.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct())
        {
            if (!Directory.Exists(root))
            {
                continue;
            }

            foreach (var candidate in Directory.EnumerateFiles(root!, "chrome", SearchOption.AllDirectories))
            {
                if (
                    candidate.Contains($"{Path.DirectorySeparatorChar}chromium-", StringComparison.Ordinal)
                    && (
                        candidate.Contains($"{Path.DirectorySeparatorChar}chrome-linux", StringComparison.Ordinal)
                        || candidate.Contains(
                            $"{Path.DirectorySeparatorChar}chrome-linux64",
                            StringComparison.Ordinal
                        )
                    )
                )
                {
                    yield return candidate;
                }
            }
        }
    }

    private static string GetOptionalValue(
        IConfiguration configuration,
        string key,
        string fallback
    ) =>
        string.IsNullOrWhiteSpace(configuration[key]) ? fallback : configuration[key]!;

    private static bool TryResolveExecutable(string? candidate, out string resolved)
    {
        resolved = string.Empty;

        if (string.IsNullOrWhiteSpace(candidate))
        {
            return false;
        }

        var trimmed = candidate.Trim();
        if (Path.IsPathRooted(trimmed) || trimmed.Contains(Path.DirectorySeparatorChar))
        {
            var directPath = Path.GetFullPath(trimmed, Directory.GetCurrentDirectory());
            if (File.Exists(directPath))
            {
                resolved = directPath;
                return true;
            }

            return false;
        }

        var pathEnv = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(pathEnv))
        {
            return false;
        }

        foreach (var segment in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var resolvedPath = Path.Combine(segment.Trim(), trimmed);
            if (File.Exists(resolvedPath))
            {
                resolved = resolvedPath;
                return true;
            }
        }

        return false;
    }
}
