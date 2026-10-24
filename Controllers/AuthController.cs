using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Subly.Data;
using Subly.Dtos;
using Subly.Models;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Регистрация и вход.</summary>
[Route("api/auth")]
[EnableRateLimiting("auth")]   // не больше 10 попыток в минуту с одного адреса
public class AuthController : AppControllerBase
{
    private readonly TokenService _tokens;

    public AuthController(Db db, TokenService tokens) : base(db) => _tokens = tokens;

    /// <summary>Регистрация нового пользователя. Сразу создаются стандартные категории.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 400)]
    [ProducesResponseType(typeof(ErrorResponse), 409)]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var name = (req.Name ?? "").Trim();
        var email = Rules.NormalizeEmail(req.Email);

        if (name.Length is < 2 or > 100) return Error(400, "Введите имя от 2 до 100 символов");
        if (!Rules.IsValidEmail(email)) return Error(400, "Некорректный адрес почты");
        if (Rules.ValidatePassword(req.Password) is { } pwdError) return Error(400, pwdError);

        await using var conn = await Db.OpenAsync();

        var taken = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM users WHERE email = @email", new { email });
        if (taken > 0) return Error(409, "Аккаунт с такой почтой уже существует");

        await using var tx = conn.BeginTransaction();
        var userId = (int)await conn.ExecuteScalarAsync<long>(
            @"INSERT INTO users (name, email, password_hash) VALUES (@name, @email, @hash) RETURNING id;",
            new { name, email, hash = BCrypt.Net.BCrypt.HashPassword(req.Password) }, tx);
        await DefaultCategories.CreateForUserAsync(conn, userId, tx);
        await tx.CommitAsync();

        var user = await conn.QuerySingleAsync<User>("SELECT * FROM users WHERE id = @userId", new { userId });
        return Ok(new AuthResponse(_tokens.Create(user), UserDto.From(user)));
    }

    /// <summary>Вход по почте и паролю. Возвращает JWT-токен.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(ErrorResponse), 401)]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var email = Rules.NormalizeEmail(req.Email);
        await using var conn = await Db.OpenAsync();

        var user = await conn.QuerySingleOrDefaultAsync<User>(
            "SELECT * FROM users WHERE email = @email", new { email });

        if (user is null || string.IsNullOrEmpty(req.Password) || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Error(401, "Неверная почта или пароль");

        return Ok(new AuthResponse(_tokens.Create(user), UserDto.From(user)));
    }
}
