using System.Security.Cryptography;
using Microsoft.Data.Sqlite;

namespace Subly.Services;

/// <summary>
/// Секретный ключ для подписи токенов входа (JWT).
/// Ключа не должно быть в репозитории: кто его знает, может «подделать» вход под любым пользователем.
/// Поэтому, если ключ не задан в настройках (или на хостинге в переменной Jwt__Key),
/// сайт сам создаёт случайный ключ и хранит его в файле jwt.key рядом с базой данных.
/// </summary>
public static class SecretKeys
{
    public static void EnsureJwtKey(ConfigurationManager config, IWebHostEnvironment env)
    {
        var key = config["Jwt:Key"];
        if (!string.IsNullOrWhiteSpace(key) && key.Length >= 32) return;   // ключ задан вручную

        // Папка, где лежит база (по умолчанию — папка проекта, на хостинге — /data)
        var csb = new SqliteConnectionStringBuilder(config.GetConnectionString("Default") ?? "Data Source=subly.db");
        var dbPath = Path.IsPathRooted(csb.DataSource) ? csb.DataSource : Path.Combine(env.ContentRootPath, csb.DataSource);
        var folder = Path.GetDirectoryName(dbPath)!;
        var file = Path.Combine(folder, "jwt.key");

        key = File.Exists(file) ? File.ReadAllText(file).Trim() : "";
        if (key.Length < 32)
        {
            key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
            Directory.CreateDirectory(folder);
            File.WriteAllText(file, key);
        }

        config["Jwt:Key"] = key;
    }
}
