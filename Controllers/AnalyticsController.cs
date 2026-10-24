using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Subly.Data;
using Subly.Dtos;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Данные для главной страницы и аналитики платежей.</summary>
[Authorize]
[Route("api")]
public class AnalyticsController : AppControllerBase
{
    public AnalyticsController(Db db) : base(db) { }

    /// <summary>Главная: имя, статистика месяца, подписки, расходы по категориям, совет.</summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        await using var conn = await Db.OpenAsync();
        await PaymentSync.SyncAsync(conn, UserId);

        var name = await conn.ExecuteScalarAsync<string>("SELECT name FROM users WHERE id = @id", new { id = UserId });
        var subs = await StatsService.LoadSubscriptionsAsync(conn, UserId);
        var stats = await StatsService.ComputeAsync(conn, UserId, subs);

        return Ok(new
        {
            userName = name,
            today = Clock.Format(Clock.Today),
            stats,
            subscriptions = subs.Select(SubscriptionDto.From),
        });
    }

    /// <summary>
    /// Аналитика за год: суммы по месяцам (оплачено + прогноз), структура расходов по категориям,
    /// ключевые показатели и ближайшие списания текущего месяца.
    /// </summary>
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics([FromQuery] int? year)
    {
        var today = Clock.Today;
        var y = year ?? today.Year;

        // Границы года в виде строк ГГГГ-ММ-ДД (так даты хранятся в SQLite)
        var yearFrom = $"{y:D4}-01-01";
        var yearTo = $"{y:D4}-12-31";

        await using var conn = await Db.OpenAsync();
        await PaymentSync.SyncAsync(conn, UserId);

        var subs = await StatsService.LoadSubscriptionsAsync(conn, UserId);
        var active = subs.Where(s => s.IsActive).ToList();
        var stats = await StatsService.ComputeAsync(conn, UserId, subs);

        // Оплачено по месяцам
        var paidByMonth = (await conn.QueryAsync<MonthRow>(
                @"SELECT CAST(strftime('%m', paid_at) AS INTEGER) AS month, ROUND(SUM(amount), 2) AS total
                  FROM payments
                  WHERE user_id = @userId AND paid_at BETWEEN @yearFrom AND @yearTo
                  GROUP BY month",
                new { userId = UserId, yearFrom, yearTo }))
            .ToDictionary(r => r.Month, r => r.Total);

        // Прогноз: будущие списания активных подписок (только для текущего и будущих месяцев)
        var months = Enumerable.Range(1, 12).Select(m =>
        {
            var start = new DateTime(y, m, 1);
            var end = start.AddMonths(1).AddDays(-1);
            var from = start > today ? start : today.AddDays(1);
            var forecast = end <= today ? 0m : active.Sum(s => PaymentSync.DatesBetween(s, from, end).Count() * s.Price);
            return new
            {
                month = m,
                paid = paidByMonth.GetValueOrDefault(m),
                forecast,
                isCurrent = y == today.Year && m == today.Month,
                isFuture = start > today,
            };
        }).ToList();

        // Структура расходов за год по категориям (по фактическим платежам)
        var byCategory = (await conn.QueryAsync<CategoryYearRow>(
                @"SELECT COALESCE(c.name, 'Без категории') AS name,
                         COALESCE(c.color, '#A3A3AD') AS color,
                         COALESCE(c.icon, 'grid') AS icon,
                         ROUND(SUM(p.amount), 2) AS total
                  FROM payments p
                  LEFT JOIN categories c ON c.id = p.category_id
                  WHERE p.user_id = @userId AND p.paid_at BETWEEN @yearFrom AND @yearTo
                  GROUP BY c.id, c.name, c.color, c.icon
                  ORDER BY total DESC",
                new { userId = UserId, yearFrom, yearTo }))
            .ToList();
        var yearTotal = byCategory.Sum(c => c.Total);

        var paidMonths = months.Count(m => m.paid > 0);
        var years = (await conn.QueryAsync<long>(
                "SELECT DISTINCT CAST(strftime('%Y', paid_at) AS INTEGER) FROM payments WHERE user_id = @userId",
                new { userId = UserId }))
            .Select(v => (int)v)
            .Append(today.Year).Distinct().OrderBy(v => v).ToList();

        // Ближайшие списания до конца текущего месяца — для таблицы «Предстоит»
        var monthEnd = Clock.MonthStart(today).AddMonths(1).AddDays(-1);
        var upcoming = active
            .Where(s => s.NextPaymentDate <= monthEnd)
            .OrderBy(s => s.NextPaymentDate)
            .Select(SubscriptionDto.From);

        return Ok(new
        {
            year = y,
            years,
            yearTotal,
            averageMonthly = paidMonths > 0 ? Math.Round(yearTotal / paidMonths, 0) : 0,
            months,
            byCategory = byCategory.Select(c => new
            {
                c.Name, c.Color, c.Icon, c.Total,
                share = yearTotal > 0 ? Math.Round(c.Total / yearTotal * 100m, 1) : 0
            }),
            stats,
            upcoming,
        });
    }

    public sealed class MonthRow
    {
        public int Month { get; set; }
        public decimal Total { get; set; }
    }

    public sealed class CategoryYearRow
    {
        public string Name { get; set; } = "";
        public string Color { get; set; } = "";
        public string Icon { get; set; } = "";
        public decimal Total { get; set; }
    }
}
