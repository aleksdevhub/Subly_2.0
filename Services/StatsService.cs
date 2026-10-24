using Dapper;
using Microsoft.Data.Sqlite;
using Subly.Models;

namespace Subly.Services;

public record CategoryShare(int Id, string Name, string Icon, string Color, int Count, decimal MonthlyTotal, decimal Share);

public record NextPaymentInfo(int SubscriptionId, string Name, decimal Amount, string Date, int DaysLeft);

public record MonthStats(
    string Month,              // yyyy-MM
    decimal Budget,
    decimal PaidThisMonth,     // уже списано в текущем месяце
    decimal UpcomingThisMonth, // ещё спишется до конца месяца
    decimal MonthTotal,        // итого за месяц
    int UpcomingCount,         // сколько списаний осталось в месяце
    decimal PrevMonthTotal,
    decimal? ChangePercent,    // изменение к прошлому месяцу, %
    int ActiveSubscriptions,
    int CategoriesUsed,
    decimal MonthlyRecurring,  // сумма всех активных подписок в пересчёте на месяц
    decimal AverageSubscription,
    decimal YearPaid,          // оплачено с начала года
    decimal AverageMonthly,    // в среднем в месяц в этом году
    NextPaymentInfo? NextPayment,
    NextPaymentInfo? MostExpensive,
    List<CategoryShare> ByCategory,
    string? Tip);

/// <summary>Подсчёт показателей для главной, аналитики и профиля.</summary>
public static class StatsService
{
    public const string SubscriptionSelect =
        @"SELECT s.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
          FROM subscriptions s
          JOIN categories c ON c.id = s.category_id";

    public static async Task<List<Subscription>> LoadSubscriptionsAsync(SqliteConnection conn, int userId) =>
        (await conn.QueryAsync<Subscription>(
            SubscriptionSelect + " WHERE s.user_id = @userId ORDER BY s.is_active DESC, s.next_payment_date, s.name",
            new { userId })).ToList();

    public static async Task<decimal> SumPaymentsAsync(SqliteConnection conn, int userId, DateTime from, DateTime to) =>
        await conn.ExecuteScalarAsync<decimal?>(
            "SELECT ROUND(SUM(amount), 2) FROM payments WHERE user_id = @userId AND paid_at BETWEEN @from AND @to",
            new { userId, from = Clock.Format(from), to = Clock.Format(to) }) ?? 0m;

    public static async Task<MonthStats> ComputeAsync(SqliteConnection conn, int userId, List<Subscription>? subs = null)
    {
        subs ??= await LoadSubscriptionsAsync(conn, userId);
        var active = subs.Where(s => s.IsActive).ToList();

        var today = Clock.Today;
        var monthStart = Clock.MonthStart(today);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var yearStart = new DateTime(today.Year, 1, 1);

        var budget = await conn.ExecuteScalarAsync<decimal>(
            "SELECT monthly_budget FROM users WHERE id = @userId", new { userId });

        var paid = await SumPaymentsAsync(conn, userId, monthStart, monthEnd);
        var prev = await SumPaymentsAsync(conn, userId, monthStart.AddMonths(-1), monthStart.AddDays(-1));

        // Предстоящие списания до конца месяца
        var upcomingDates = active
            .SelectMany(s => PaymentSync.DatesBetween(s, today.AddDays(1), monthEnd).Select(_ => s.Price))
            .ToList();
        var upcoming = upcomingDates.Sum();
        var total = paid + upcoming;

        decimal? change = prev > 0 ? Math.Round((total - prev) / prev * 100m, 1) : null;

        // Среднее в месяц с начала года (с месяца первого платежа)
        var yearPaidBefore = await SumPaymentsAsync(conn, userId, yearStart, monthStart.AddDays(-1));
        var firstPaid = await conn.ExecuteScalarAsync<string?>(
            "SELECT MIN(paid_at) FROM payments WHERE user_id = @userId AND paid_at >= @yearStart",
            new { userId, yearStart = Clock.Format(yearStart) });
        var firstMonth = Clock.TryParseDate(firstPaid, out var fp) ? fp.Month : today.Month;
        var monthsCount = Math.Max(1, today.Month - firstMonth + 1);
        var averageMonthly = Math.Round((yearPaidBefore + total) / monthsCount, 0);

        var recurring = active.Sum(s => s.MonthlyPrice);

        var next = active.OrderBy(s => s.NextPaymentDate).ThenBy(s => s.Name).FirstOrDefault();
        var expensive = active.OrderByDescending(s => s.MonthlyPrice).FirstOrDefault();

        var byCategory = active
            .GroupBy(s => s.CategoryId)
            .Select(g =>
            {
                var first = g.First();
                var sum = g.Sum(s => s.MonthlyPrice);
                return new CategoryShare(g.Key, first.CategoryName ?? "", first.CategoryIcon ?? "grid",
                    first.CategoryColor ?? "#5B4CF0", g.Count(), sum,
                    recurring > 0 ? Math.Round(sum / recurring * 100m, 1) : 0);
            })
            .OrderByDescending(c => c.MonthlyTotal)
            .ToList();

        return new MonthStats(
            Month: monthStart.ToString("yyyy-MM"),
            Budget: budget,
            PaidThisMonth: paid,
            UpcomingThisMonth: upcoming,
            MonthTotal: total,
            UpcomingCount: upcomingDates.Count,
            PrevMonthTotal: prev,
            ChangePercent: change,
            ActiveSubscriptions: active.Count,
            CategoriesUsed: byCategory.Count,
            MonthlyRecurring: recurring,
            AverageSubscription: active.Count > 0 ? Math.Round(recurring / active.Count, 0) : 0,
            YearPaid: yearPaidBefore + paid,
            AverageMonthly: averageMonthly,
            NextPayment: next is null ? null : Info(next, next.Price),
            MostExpensive: expensive is null ? null : Info(expensive, expensive.MonthlyPrice),
            ByCategory: byCategory,
            Tip: BuildTip(active));
    }

    private static NextPaymentInfo Info(Subscription s, decimal amount) =>
        new(s.Id, s.Name, amount, Clock.Format(s.NextPaymentDate), (s.NextPaymentDate.Date - Clock.Today).Days);

    /// <summary>Совет: если в одной категории несколько подписок — можно отказаться от одной.</summary>
    private static string? BuildTip(List<Subscription> active)
    {
        var dup = active
            .GroupBy(s => s.CategoryName)
            .Where(g => g.Count() >= 2)
            .OrderByDescending(g => g.Min(s => s.MonthlyPrice))
            .FirstOrDefault();
        if (dup is null) return null;

        var names = dup.Select(s => s.Name).ToList();
        var list = names.Count == 2 ? $"{names[0]} и {names[1]}" : string.Join(", ", names);
        var saving = dup.Min(s => s.MonthlyPrice);
        return $"У вас {names.Count} {Rules.Plural(names.Count, "подписка", "подписки", "подписок")} в категории «{dup.Key}» — {list}. " +
               $"Отключите одну и сэкономите {saving:0.##} ₽ в месяц.";
    }
}
