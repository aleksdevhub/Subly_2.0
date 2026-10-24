using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Subly.Models;

namespace Subly.Services;

/// <summary>Выпускает JWT-токены, которыми фронтенд подписывает запросы к API.</summary>
public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public static SymmetricSecurityKey GetKey(IConfiguration config)
    {
        var key = config["Jwt:Key"];
        if (string.IsNullOrEmpty(key) || key.Length < 32)
            throw new InvalidOperationException("Jwt:Key должен быть не короче 32 символов");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public string Create(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),   // "admin" — для будущего меню администратора
        };

        var days = int.TryParse(_config["Jwt:LifetimeDays"], out var d) ? d : 7;
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Issuer"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(days),
            signingCredentials: new SigningCredentials(GetKey(_config), SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class ClaimsExtensions
{
    /// <summary>Id текущего пользователя из JWT-токена.</summary>
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? throw new UnauthorizedAccessException());
}
