using System.Globalization;

namespace Subly.Services;

/// <summary>
/// «Сегодняшняя дата» в часовом поясе сервиса (по умолчанию — Москва),
/// чтобы списания считались одинаково на любом сервере.
/// </summary>
public static class Clock
{
    private static TimeZoneInfo _zone = FindZone("Europe/Moscow");

    public static void Configure(string? timeZoneId)
    {
        if (!string.IsNullOrWhiteSpace(timeZoneId))
            _zone = FindZone(timeZoneId);
    }

    public static DateTime Today => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zone).Date;

    public static DateTime MonthStart(DateTime d) => new(d.Year, d.Month, 1);

    public static string Format(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static bool TryParseDate(string? value, out DateTime date) =>
        DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static TimeZoneInfo FindZone(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch
        {
            // На старых Windows без ICU: запасной вариант UTC+3
            try { return TimeZoneInfo.FindSystemTimeZoneById("Russian Standard Time"); }
            catch { return TimeZoneInfo.CreateCustomTimeZone("UTC+3", TimeSpan.FromHours(3), "UTC+3", "UTC+3"); }
        }
    }
}
