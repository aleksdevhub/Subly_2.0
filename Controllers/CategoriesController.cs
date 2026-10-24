using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Subly.Data;
using Subly.Dtos;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Категории подписок: музыка, фильмы, VPN и т.д.</summary>
[Authorize]
[Route("api/categories")]
public class CategoriesController : AppControllerBase
{
    public CategoriesController(Db db) : base(db) { }

    private const string ListSql =
        @"SELECT c.id, c.name, c.icon, c.color,
                 COUNT(s.id) AS subscriptions_count,
                 COALESCE(SUM(CASE WHEN s.is_active = 1 THEN
                     CASE WHEN s.billing_period = 'yearly' THEN ROUND(s.price / 12, 2) ELSE s.price END
                 END), 0.0) AS monthly_total
          FROM categories c
          LEFT JOIN subscriptions s ON s.category_id = c.id
          WHERE c.user_id = @userId";

    /// <summary>Все категории пользователя с количеством подписок и суммой в месяц.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CategoryDto>), 200)]
    public async Task<IActionResult> GetAll()
    {
        await using var conn = await Db.OpenAsync();
        var list = await conn.QueryAsync<CategoryRow>(
            ListSql + " GROUP BY c.id, c.name, c.icon, c.color ORDER BY monthly_total DESC, c.name",
            new { userId = UserId });
        return Ok(list.Select(r => r.ToDto()));
    }

    /// <summary>Создать категорию.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CategoryDto), 201)]
    public async Task<IActionResult> Create(CategoryRequest req)
    {
        if (Validate(req) is { } error) return Error(400, error);

        await using var conn = await Db.OpenAsync();
        try
        {
            var id = (int)await conn.ExecuteScalarAsync<long>(
                @"INSERT INTO categories (user_id, name, icon, color)
                  VALUES (@userId, @name, @icon, @color)
                  RETURNING id;",
                new { userId = UserId, name = req.Name.Trim(), icon = req.Icon, color = req.Color.ToUpperInvariant() });
            return StatusCode(201, await LoadAsync(conn, id));
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) // нарушение уникальности (SQLITE_CONSTRAINT)
        {
            return Error(409, "Категория с таким названием уже есть");
        }
    }

    /// <summary>Изменить название, иконку или цвет категории.</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(CategoryDto), 200)]
    public async Task<IActionResult> Update(int id, CategoryRequest req)
    {
        if (Validate(req) is { } error) return Error(400, error);

        await using var conn = await Db.OpenAsync();
        try
        {
            await conn.ExecuteAsync(
                "UPDATE categories SET name = @name, icon = @icon, color = @color WHERE id = @id AND user_id = @userId",
                new { id, userId = UserId, name = req.Name.Trim(), icon = req.Icon, color = req.Color.ToUpperInvariant() });
            var dto = await LoadAsync(conn, id);
            return dto is null ? Error(404, "Категория не найдена") : Ok(dto);
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) // нарушение уникальности (SQLITE_CONSTRAINT)
        {
            return Error(409, "Категория с таким названием уже есть");
        }
    }

    /// <summary>Удалить категорию. Нельзя удалить категорию, в которой есть подписки.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var conn = await Db.OpenAsync();
        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM categories WHERE id = @id AND user_id = @userId", new { id, userId = UserId });
        if (exists == 0) return Error(404, "Категория не найдена");

        var subs = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM subscriptions WHERE category_id = @id", new { id });
        if (subs > 0)
            return Error(409, $"В категории {subs} {Rules.Plural(subs, "подписка", "подписки", "подписок")}. " +
                              "Перенесите их в другую категорию или удалите, а затем удалите категорию.");

        // История платежей остаётся, но без ссылки на удалённую категорию
        await conn.ExecuteAsync("UPDATE payments SET category_id = NULL WHERE category_id = @id AND user_id = @userId", new { id, userId = UserId });
        await conn.ExecuteAsync("DELETE FROM categories WHERE id = @id AND user_id = @userId", new { id, userId = UserId });
        return NoContent();
    }

    private async Task<CategoryDto?> LoadAsync(SqliteConnection conn, int id)
    {
        var row = await conn.QuerySingleOrDefaultAsync<CategoryRow>(
            ListSql + " AND c.id = @id GROUP BY c.id, c.name, c.icon, c.color", new { userId = UserId, id });
        return row?.ToDto();
    }

    private static string? Validate(CategoryRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length is < 1 or > 60) return "Введите название категории (до 60 символов)";
        if (!Rules.AllowedIcons.Contains(req.Icon)) return "Неизвестная иконка";
        if (!Rules.IsValidColor(req.Color)) return "Цвет должен быть в формате #RRGGBB";
        return null;
    }

    public sealed class CategoryRow
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Icon { get; set; } = "";
        public string Color { get; set; } = "";
        public int SubscriptionsCount { get; set; }
        public decimal MonthlyTotal { get; set; }
        public CategoryDto ToDto() => new(Id, Name, Icon, Color, SubscriptionsCount, MonthlyTotal);
    }
}
