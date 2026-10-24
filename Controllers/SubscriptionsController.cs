using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Subly.Data;
using Subly.Dtos;
using Subly.Models;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Подписки пользователя: список, добавление, изменение, удаление.</summary>
[Authorize]
[Route("api/subscriptions")]
public class SubscriptionsController : AppControllerBase
{
    public SubscriptionsController(Db db) : base(db) { }

    /// <summary>Список подписок. Можно отфильтровать по категории.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<SubscriptionDto>), 200)]
    public async Task<IActionResult> GetAll([FromQuery] int? categoryId)
    {
        await using var conn = await Db.OpenAsync();
        await PaymentSync.SyncAsync(conn, UserId);

        var subs = await StatsService.LoadSubscriptionsAsync(conn, UserId);
        if (categoryId is not null) subs = subs.Where(s => s.CategoryId == categoryId).ToList();
        return Ok(subs.Select(SubscriptionDto.From));
    }

    /// <summary>Одна подписка по Id.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(SubscriptionDto), 200)]
    public async Task<IActionResult> Get(int id)
    {
        await using var conn = await Db.OpenAsync();
        var sub = await LoadAsync(conn, id);
        return sub is null ? Error(404, "Подписка не найдена") : Ok(SubscriptionDto.From(sub));
    }

    /// <summary>
    /// Добавить подписку. Если дата следующего списания уже прошла,
    /// прошедшие списания будут записаны в историю платежей.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(SubscriptionDto), 201)]
    public async Task<IActionResult> Create(SubscriptionRequest req)
    {
        await using var conn = await Db.OpenAsync();
        var (error, nextDate) = await ValidateAsync(conn, req);
        if (error is not null) return Error(400, error);

        var id = (int)await conn.ExecuteScalarAsync<long>(
            @"INSERT INTO subscriptions
                (user_id, category_id, name, price, billing_period, start_date, next_payment_date, payment_method, is_active)
              VALUES (@userId, @CategoryId, @name, @Price, @BillingPeriod, @nextDate, @nextDate, @method, @IsActive)
              RETURNING id;",
            new
            {
                userId = UserId, req.CategoryId, name = req.Name.Trim(), req.Price, req.BillingPeriod,
                nextDate = Clock.Format(nextDate), method = CleanMethod(req.PaymentMethod), req.IsActive
            });

        await PaymentSync.SyncAsync(conn, UserId);
        var sub = await LoadAsync(conn, id);
        return StatusCode(201, SubscriptionDto.From(sub!));
    }

    /// <summary>Изменить подписку (цену, категорию, дату списания, включить/отключить).</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(SubscriptionDto), 200)]
    public async Task<IActionResult> Update(int id, SubscriptionRequest req)
    {
        await using var conn = await Db.OpenAsync();
        var existing = await LoadAsync(conn, id);
        if (existing is null) return Error(404, "Подписка не найдена");

        var (error, nextDate) = await ValidateAsync(conn, req);
        if (error is not null) return Error(400, error);

        // Подписку включили обратно после паузы: не начисляем платежи за время паузы,
        // а переносим дату списания на ближайшую будущую.
        if (!existing.IsActive && req.IsActive && nextDate <= Clock.Today)
        {
            var anchor = nextDate.Day;
            while (nextDate <= Clock.Today) nextDate = PaymentSync.NextDate(nextDate, req.BillingPeriod, anchor);
        }

        await conn.ExecuteAsync(
            @"UPDATE subscriptions
              SET category_id = @CategoryId, name = @name, price = @Price, billing_period = @BillingPeriod,
                  next_payment_date = @nextDate, payment_method = @method, is_active = @IsActive,
                  start_date = CASE WHEN start_date < @nextDate THEN start_date ELSE @nextDate END
              WHERE id = @id AND user_id = @userId",
            new
            {
                id, userId = UserId, req.CategoryId, name = req.Name.Trim(), req.Price, req.BillingPeriod,
                nextDate = Clock.Format(nextDate), method = CleanMethod(req.PaymentMethod), req.IsActive
            });

        await PaymentSync.SyncAsync(conn, UserId);
        return Ok(SubscriptionDto.From((await LoadAsync(conn, id))!));
    }

    /// <summary>Удалить подписку. История её платежей сохраняется.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var conn = await Db.OpenAsync();
        var p = new { id, userId = UserId };
        var exists = await conn.ExecuteScalarAsync<long>(
            "SELECT COUNT(*) FROM subscriptions WHERE id = @id AND user_id = @userId", p);
        if (exists == 0) return Error(404, "Подписка не найдена");

        // История платежей сохраняется: отвязываем платежи от удаляемой подписки
        await using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync("UPDATE payments SET subscription_id = NULL WHERE subscription_id = @id AND user_id = @userId", p, tx);
        await conn.ExecuteAsync("DELETE FROM subscriptions WHERE id = @id AND user_id = @userId", p, tx);
        await tx.CommitAsync();
        return NoContent();
    }

    private async Task<Subscription?> LoadAsync(SqliteConnection conn, int id) =>
        await conn.QuerySingleOrDefaultAsync<Subscription>(
            StatsService.SubscriptionSelect + " WHERE s.id = @id AND s.user_id = @userId",
            new { id, userId = UserId });

    private static string? CleanMethod(string? method)
    {
        var m = (method ?? "").Trim();
        return m.Length == 0 ? null : m.Length > 40 ? m[..40] : m;
    }

    private async Task<(string? Error, DateTime NextDate)> ValidateAsync(SqliteConnection conn, SubscriptionRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length is < 1 or > 100) return ("Введите название подписки (до 100 символов)", default);
        if (req.Price is <= 0 or > 1_000_000) return ("Стоимость должна быть больше нуля", default);
        if (req.BillingPeriod is not ("monthly" or "yearly")) return ("Период оплаты: monthly или yearly", default);
        if (!Clock.TryParseDate(req.NextPaymentDate, out var next)) return ("Укажите дату следующего списания", default);
        if (next < Clock.Today.AddYears(-3) || next > Clock.Today.AddYears(5))
            return ("Дата списания должна быть не раньше чем 3 года назад и не позже чем через 5 лет", default);

        var categoryOk = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM categories WHERE id = @id AND user_id = @userId",
            new { id = req.CategoryId, userId = UserId });
        if (categoryOk == 0) return ("Выберите категорию", default);

        return (null, next);
    }
}
