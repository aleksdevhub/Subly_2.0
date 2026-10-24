using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.Sqlite;

namespace Subly.Services;

public static class Rules
{
    public static readonly string[] AllowedIcons =
        { "music", "film", "shield", "cloud", "games", "book", "code", "grid", "card", "home", "mail", "chart" };

    /// <summary>Пароль: не короче 8 символов, есть хотя бы одна буква и одна цифра.</summary>
    public static string? ValidatePassword(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8)
            return "Пароль должен быть не короче 8 символов";
        if (password.Length > 100)
            return "Пароль слишком длинный";
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            return "Пароль должен содержать буквы и цифры";
        return null;
    }

    /// <summary>Склонение: 1 подписка, 2 подписки, 5 подписок.</summary>
    public static string Plural(int n, string one, string few, string many)
    {
        var mod100 = Math.Abs(n) % 100;
        var mod10 = mod100 % 10;
        if (mod100 is >= 11 and <= 14) return many;
        return mod10 switch { 1 => one, >= 2 and <= 4 => few, _ => many };
    }

    public static string NormalizeEmail(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public static bool IsValidEmail(string email) =>
        email.Length <= 255 && Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    public static bool IsValidColor(string? color) =>
        color is not null && Regex.IsMatch(color, "^#[0-9A-Fa-f]{6}$");
}

/// <summary>Стандартные категории, которые создаются каждому новому пользователю.</summary>
public static class DefaultCategories
{
    public static readonly (string Name, string Icon, string Color)[] Items =
    {
        ("Музыка", "music", "#F25F8B"),
        ("Фильмы и сериалы", "film", "#5B4CF0"),
        ("VPN", "shield", "#1FA88A"),
        ("Облако", "cloud", "#3B8CF0"),
        ("Игры", "games", "#E8962C"),
        ("Образование", "book", "#9B5DE5"),
        ("Софт", "code", "#16161D"),
    };

    public static async Task CreateForUserAsync(SqliteConnection conn, int userId, SqliteTransaction? tx = null)
    {
        foreach (var (name, icon, color) in Items)
        {
            await conn.ExecuteAsync(
                "INSERT INTO categories (user_id, name, icon, color) VALUES (@userId, @name, @icon, @color)",
                new { userId, name, icon, color }, tx);
        }
    }
}
