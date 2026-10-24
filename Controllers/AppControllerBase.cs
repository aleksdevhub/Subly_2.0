using Microsoft.AspNetCore.Mvc;
using Subly.Data;
using Subly.Dtos;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>Общий базовый класс: доступ к БД, Id пользователя и ответы с ошибкой.</summary>
[ApiController]
[Produces("application/json")]
public abstract class AppControllerBase : ControllerBase
{
    protected readonly Db Db;

    protected AppControllerBase(Db db) => Db = db;

    /// <summary>Id авторизованного пользователя (из JWT-токена).</summary>
    protected int UserId => User.GetUserId();

    protected ObjectResult Error(int status, string message) =>
        StatusCode(status, new ErrorResponse(message));
}
