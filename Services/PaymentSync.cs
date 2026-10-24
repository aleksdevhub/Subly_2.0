using Dapper;
using Microsoft.Data.Sqlite;
using Subly.Models;

namespace Subly.Services;

/// <summary>
/// Автоматический учёт списаний.
/// Если дата следующего списания подписки уже наступила, сервис записывает платёж
/// в историю (таблица payments) и переносит дату на следующий период.
/// Вызывается перед каждым запросом, где важны актуальные суммы.
/// </summary>
public static class PaymentSync
{
    public static async Task SyncAsync(SqliteConnection conn, int userId)
    {
        var today = Clock.Today;

        var due = (await conn.QueryAsync<Subscription>(
            @"SELECT * FROM subscriptions
              WHERE user_id = @userId AND is_active = 1 AND next_payment_date <= @today",
            new { userId, today = Clock.Format(today) })).ToList();

        foreach (var sub in due)
        {
            var next = sub.NextPaymentDate.Date;
            var anchorDay = AnchorDay(sub);

            await using var tx = conn.BeginTransaction();
            try
            {
                while (next <= today)
                {
                    // INSERT OR IGNORE + уникальный индекс (subscription_id, paid_at) защищают от дублей
                    await conn.ExecuteAsync(
                        @"INSERT OR IGNORE INTO payments
                            (user_id, subscription_id, category_id, subscription_name, amount, paid_at, payment_method)
                          VALUES (@UserId, @Id, @CategoryId, @Name, @Price, @PaidAt, @PaymentMethod)",
                        new { sub.UserId, sub.Id, sub.CategoryId, sub.Name, sub.Price, PaidAt = Clock.Format(next), sub.PaymentMethod },
                        tx);
                    next = NextDate(next, sub.BillingPeriod, anchorDay);
                }

                await conn.ExecuteAsync(
                    "UPDATE subscriptions SET next_payment_date = @next WHERE id = @id",
                    new { next = Clock.Format(next), id = sub.Id }, tx);
                await tx.CommitAsync();
            }
            catch (SqliteException ex) when (ex.SqliteErrorCode == 19) // SQLITE_CONSTRAINT
            {
                // Параллельный запрос уже записал эти платежи — просто откатываем свою попытку
                await tx.RollbackAsync();
            }
        }
    }

    /// <summary>Следующая дата списания с сохранением «дня месяца» (например, всегда 31-е или последний день).</summary>
    public static DateTime NextDate(DateTime current, string period, int anchorDay)
    {
        var target = period == "yearly" ? current.AddYears(1) : current.AddMonths(1);
        var day = Math.Min(anchorDay, DateTime.DaysInMonth(target.Year, target.Month));
        return new DateTime(target.Year, target.Month, day);
    }

    /// <summary>
    /// «День списания». Обычно это день из даты следующего платежа; для конца месяца
    /// (28–31) учитываем день первого платежа, чтобы 31-е не «съезжало» на 28-е после февраля.
    /// </summary>
    public static int AnchorDay(Subscription sub)
    {
        var day = sub.NextPaymentDate.Day;
        return day >= 28 ? Math.Max(day, sub.StartDate.Day) : day;
    }

    /// <summary>Все будущие даты списаний подписки в диапазоне [from; to].</summary>
    public static IEnumerable<DateTime> DatesBetween(Subscription sub, DateTime from, DateTime to)
    {
        var d = sub.NextPaymentDate.Date;
        var anchorDay = AnchorDay(sub);
        var guard = 0;
        while (d <= to && guard++ < 500)
        {
            if (d >= from) yield return d;
            d = NextDate(d, sub.BillingPeriod, anchorDay);
        }
    }
}
