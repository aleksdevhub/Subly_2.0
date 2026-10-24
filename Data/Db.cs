using Microsoft.Data.Sqlite;

namespace Subly.Data;

/// <summary>
/// Подключение к базе SQLite. База — это один файл (по умолчанию subly.db в папке проекта).
/// Путь задаётся в appsettings.json (ConnectionStrings:Default).
/// Если файла ещё нет, SQLite создаст его сам при первом подключении.
/// </summary>
public class Db
{
    private readonly string _connectionString;

    /// <summary>Полный путь к файлу базы данных (показывается в логе при запуске).</summary>
    public string FilePath { get; }

    public Db(IConfiguration config, IWebHostEnvironment env)
    {
        var csb = new SqliteConnectionStringBuilder(config.GetConnectionString("Default") ?? "Data Source=subly.db");

        // Относительный путь считаем от папки проекта, чтобы файл лежал рядом с Program.cs
        if (!Path.IsPathRooted(csb.DataSource))
            csb.DataSource = Path.Combine(env.ContentRootPath, csb.DataSource);

        Directory.CreateDirectory(Path.GetDirectoryName(csb.DataSource)!);
        csb.ForeignKeys = true;          // включаем проверку внешних ключей
        csb.DefaultTimeout = 30;         // ждать до 30 секунд, если база занята другим запросом

        FilePath = csb.DataSource;
        _connectionString = csb.ToString();
    }

    public async Task<SqliteConnection> OpenAsync()
    {
        var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        return conn;
    }
}
