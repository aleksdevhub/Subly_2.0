using Dapper;
using Microsoft.Data.Sqlite;
using Subly.Services;

namespace Subly.Data;

/// <summary>
/// При старте приложения: создаёт таблицы из Database/schema.sql
/// и аккаунт администратора (данные — в appsettings.json, раздел "Admin").
/// </summary>
public static class DbInitializer
{
    /// <summary>Старый демо-аккаунт: если он есть в базе, он становится администратором</summary>
    private const string OldDemoEmail = "demo@subly.ru";

    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        var db = services.GetRequiredService<Db>();
        await using var conn = await db.OpenAsync();

        // WAL-режим: чтение и запись не мешают друг другу
        await conn.ExecuteAsync("PRAGMA journal_mode = WAL;");

        await ApplySchemaAsync(conn);
        await MigrateAsync(conn);
        logger.LogInformation("База данных SQLite: {Path}", db.FilePath);

        await EnsureAdminAsync(conn, config, logger);
    }

    private static async Task ApplySchemaAsync(SqliteConnection conn)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Database", "schema.sql");
        var sql = await File.ReadAllTextAsync(path);
        // SQLite умеет выполнить весь скрипт одной командой
        await conn.ExecuteAsync(sql);
    }

    /// <summary>Обновление базы, созданной старой версией: добавляем колонку role</summary>
    private static async Task MigrateAsync(SqliteConnection conn)
    {
        var columns = (await conn.QueryAsync<string>("SELECT name FROM pragma_table_info('users')")).ToList();
        if (!columns.Contains("role"))
            await conn.ExecuteAsync(
                "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))");
    }

    /// <summary>
    /// Следит, чтобы в базе был администратор с именем из настроек.
    /// 1) админ уже есть — только возвращаем ему имя из настроек;
    /// 2) есть старый демо-аккаунт — превращаем его в админа (подписки сохраняются);
    /// 3) иначе создаём админа заново (с примерами подписок, если Seed:DemoData = true).
    /// </summary>
    private static async Task EnsureAdminAsync(SqliteConnection conn, IConfiguration config, ILogger logger)
    {
        var name = config["Admin:Name"] ?? "Администратор";
        var email = (config["Admin:Email"] ?? "admin@subly.ru").Trim().ToLowerInvariant();
        var password = config["Admin:Password"] ?? "Admin2026";

        var adminId = await conn.ExecuteScalarAsync<long?>(
            "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
        if (adminId is not null)
        {
            await conn.ExecuteAsync("UPDATE users SET name = @name WHERE id = @adminId", new { name, adminId });
            return;
        }

        // Аккаунт с почтой админа или старый демо-аккаунт — назначаем администратором
        var existingId = await conn.ExecuteScalarAsync<long?>(
            @"SELECT id FROM users WHERE email = @email
              UNION ALL
              SELECT id FROM users WHERE email = @OldDemoEmail
              LIMIT 1", new { email, OldDemoEmail });
        if (existingId is not null)
        {
            await conn.ExecuteAsync(
                @"UPDATE users SET role = 'admin', name = @name, email = @email, password_hash = @hash
                  WHERE id = @existingId",
                new { name, email, hash = BCrypt.Net.BCrypt.HashPassword(password), existingId });
            logger.LogInformation("Администратор: {Email}", email);
            return;
        }

        await CreateAdminAsync(conn, name, email, password, config.GetValue("Seed:DemoData", true));
        logger.LogInformation("Создан администратор {Email} / {Password}", email, password);
    }

    private static async Task CreateAdminAsync(SqliteConnection conn, string name, string email, string password, bool withDemoData)
    {
        var today = Clock.Today;
        var thisMonth = Clock.MonthStart(today);
        var createdAt = Clock.Format(thisMonth.AddMonths(-9)) + " 12:00:00";

        await using var tx = conn.BeginTransaction();

        var userId = (int)await conn.ExecuteScalarAsync<long>(
            @"INSERT INTO users (name, email, password_hash, monthly_budget, role, created_at)
              VALUES (@name, @email, @hash, 5000, 'admin', @createdAt)
              RETURNING id;",
            new { name, email, hash = BCrypt.Net.BCrypt.HashPassword(password), createdAt }, tx);

        await DefaultCategories.CreateForUserAsync(conn, userId, tx);
        if (!withDemoData)
        {
            await tx.CommitAsync();
            return;
        }
        var categories = (await conn.QueryAsync<Models.Category>(
            "SELECT * FROM categories WHERE user_id = @userId", new { userId }, tx))
            .ToDictionary(c => c.Name, c => c.Id);

        // Примеры подписок: название, категория, цена, день списания, сколько месяцев назад оформлена, способ оплаты
        var demo = new (string Name, string Category, decimal Price, int Day, int MonthsAgo, string Method)[]
        {
            ("Яндекс Музыка", "Музыка", 299, 18, 9, "Мир •• 0921"),
            ("Okko", "Фильмы и сериалы", 399, 21, 5, "Visa •• 4417"),
            ("AmneziaVPN", "VPN", 290, 24, 7, "Мир •• 0921"),
            ("Яндекс 360", "Облако", 199, 27, 9, "Мир •• 0921"),
            ("Иви", "Фильмы и сериалы", 399, 2, 9, "Visa •• 4417"),
            ("Notion Plus", "Софт", 990, 3, 9, "Visa •• 4417"),
            ("iCloud+", "Облако", 149, 5, 9, "Visa •• 4417"),
            ("PS Plus", "Игры", 899, 9, 6, "Мир •• 0921"),
            ("Duolingo Super", "Образование", 599, 12, 8, "Visa •• 4417"),
        };

        foreach (var s in demo)
        {
            var month = thisMonth.AddMonths(-s.MonthsAgo);
            var start = Clock.Format(new DateTime(month.Year, month.Month,
                Math.Min(s.Day, DateTime.DaysInMonth(month.Year, month.Month))));
            await conn.ExecuteAsync(
                @"INSERT INTO subscriptions
                    (user_id, category_id, name, price, billing_period, start_date, next_payment_date, payment_method, is_active, created_at)
                  VALUES (@userId, @categoryId, @name, @price, 'monthly', @start, @start, @method, 1, @start)",
                new { userId, categoryId = categories[s.Category], name = s.Name, price = s.Price, start, method = s.Method }, tx);
        }

        await tx.CommitAsync();

        // Записываем все прошедшие списания в историю платежей
        await PaymentSync.SyncAsync(conn, userId);
    }
}
