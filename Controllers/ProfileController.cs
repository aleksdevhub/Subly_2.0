using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Subly.Data;
using Subly.Dtos;
using Subly.Models;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Профиль: данные пользователя, траты за месяц, смена пароля, удаление аккаунта.</summary>
[Authorize]
[Route("api/profile")]
public class ProfileController : AppControllerBase
{
    private readonly TokenService _tokens;

    public ProfileController(Db db, TokenService tokens) : base(db) => _tokens = tokens;

    /// <summary>Данные пользователя и статистика (сколько потрачено в этом месяце и т.д.).</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        await using var conn = await Db.OpenAsync();
        var user = await conn.QuerySingleOrDefaultAsync<User>("SELECT * FROM users WHERE id = @id", new { id = UserId });
        if (user is null) return Error(401, "Пользователь не найден");

        await PaymentSync.SyncAsync(conn, UserId);
        var stats = await StatsService.ComputeAsync(conn, UserId);
        return Ok(new { user = UserDto.From(user), stats });
    }

    /// <summary>Изменить имя, почту и месячный бюджет.</summary>
    [HttpPut]
    public async Task<IActionResult> Update(UpdateProfileRequest req)
    {
        var name = (req.Name ?? "").Trim();
        var email = Rules.NormalizeEmail(req.Email);
        if (name.Length is < 2 or > 100) return Error(400, "Введите имя от 2 до 100 символов");
        if (!Rules.IsValidEmail(email)) return Error(400, "Некорректный адрес почты");
        if (req.MonthlyBudget is < 0 or > 10_000_000) return Error(400, "Некорректный бюджет");

        await using var conn = await Db.OpenAsync();
        var taken = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM users WHERE email = @email AND id <> @id", new { email, id = UserId });
        if (taken > 0) return Error(409, "Эта почта уже используется другим аккаунтом");

        await conn.ExecuteAsync(
            "UPDATE users SET name = @name, email = @email, monthly_budget = @budget WHERE id = @id",
            new { name, email, budget = req.MonthlyBudget, id = UserId });

        var user = await conn.QuerySingleAsync<User>("SELECT * FROM users WHERE id = @id", new { id = UserId });
        // Почта и имя лежат в токене, поэтому выдаём новый
        return Ok(new AuthResponse(_tokens.Create(user), UserDto.From(user)));
    }

    /// <summary>Смена пароля. Нужно ввести текущий пароль.</summary>
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        await using var conn = await Db.OpenAsync();
        var hash = await conn.ExecuteScalarAsync<string>("SELECT password_hash FROM users WHERE id = @id", new { id = UserId });

        if (hash is null) return Error(401, "Пользователь не найден");
        if (string.IsNullOrEmpty(req.CurrentPassword) || !BCrypt.Net.BCrypt.Verify(req.CurrentPassword, hash))
            return Error(400, "Текущий пароль введён неверно");
        if (Rules.ValidatePassword(req.NewPassword) is { } pwdError)
            return Error(400, pwdError);
        if (req.NewPassword == req.CurrentPassword)
            return Error(400, "Новый пароль должен отличаться от текущего");

        await conn.ExecuteAsync("UPDATE users SET password_hash = @hash WHERE id = @id",
            new { hash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword), id = UserId });

        return Ok(new { message = "Пароль изменён" });
    }

    /// <summary>
    /// Удаление аккаунта. Требуется пароль и подтверждение — слово «УДАЛИТЬ».
    /// Вместе с пользователем удаляются его подписки, категории и платежи.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> Delete(DeleteAccountRequest req)
    {
        if ((req.Confirmation ?? "").Trim().ToUpperInvariant() != "УДАЛИТЬ")
            return Error(400, "Для подтверждения введите слово УДАЛИТЬ");

        await using var conn = await Db.OpenAsync();
        var hash = await conn.ExecuteScalarAsync<string>("SELECT password_hash FROM users WHERE id = @id", new { id = UserId });
        if (hash is null) return Error(401, "Пользователь не найден");
        if (string.IsNullOrEmpty(req.Password) || !BCrypt.Net.BCrypt.Verify(req.Password, hash))
            return Error(400, "Неверный пароль");

        // Удаляем по порядку в одной транзакции: платежи → подписки → категории → пользователь
        await using var tx = conn.BeginTransaction();
        var p = new { id = UserId };
        await conn.ExecuteAsync("DELETE FROM payments WHERE user_id = @id", p, tx);
        await conn.ExecuteAsync("DELETE FROM subscriptions WHERE user_id = @id", p, tx);
        await conn.ExecuteAsync("DELETE FROM categories WHERE user_id = @id", p, tx);
        await conn.ExecuteAsync("DELETE FROM users WHERE id = @id", p, tx);
        await tx.CommitAsync();
        return NoContent();
    }
}
