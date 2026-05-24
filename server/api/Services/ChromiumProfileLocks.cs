namespace api.Services;

public static class ChromiumProfileLocks
{
    private static readonly string[] LockFileNames =
    [
        "SingletonCookie",
        "SingletonLock",
        "SingletonSocket",
    ];

    public static IReadOnlyList<string> ClearStaleLocks(string profileDirectory)
    {
        var removed = new List<string>();

        if (string.IsNullOrWhiteSpace(profileDirectory) || !Directory.Exists(profileDirectory))
        {
            return removed;
        }

        foreach (var lockFileName in LockFileNames)
        {
            var path = Path.Combine(profileDirectory, lockFileName);

            try
            {
                if (!Path.Exists(path))
                {
                    continue;
                }

                var attributes = File.GetAttributes(path);
                if (
                    attributes.HasFlag(FileAttributes.Directory)
                    && !attributes.HasFlag(FileAttributes.ReparsePoint)
                )
                {
                    Directory.Delete(path, recursive: true);
                }
                else
                {
                    File.Delete(path);
                }

                removed.Add(path);
            }
            catch (Exception exception) when (
                exception is IOException
                or UnauthorizedAccessException
                or System.Security.SecurityException
            )
            {
                // If Chromium still owns the profile, startup should fail loudly instead.
            }
        }

        return removed;
    }
}
