using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Subly.Data;
using Subly.Dtos;
using Subly.Models;
using Subly.Services;

namespace Subly.Controllers;

/// <summary>История платежей.</summary>
[Authorize]
[Route("api/payments")]
public class PaymentsController : AppControllerBase
{
    public PaymentsController(Db db) : base(db) { }

    /// <summary>Платежи за год (по умолчанию — текущий), новые сверху.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PaymentDto>), 200)]
    public async Task<IActionResult> GetAll([FromQuery] int? year, [FromQuery] int? categoryId, [FromQuery] int limit = 500)
    {
        var y = year ?? Clock.Today.Year;
        limit = Math.Clamp(limit, 1, 1000);

        await using var conn = await Db.OpenAsync();
        await PaymentSync.SyncAsync(conn, UserId);

        var sql = @"SELECT p.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
                    FROM payments p
                    LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.user_id = @userId AND p.paid_at BETWEEN @yearFrom AND @yearTo"
                  + (categoryId is null ? "" : " AND p.category_id = @categoryId")
                  + " ORDER BY p.paid_at DESC, p.id DESC LIMIT @limit";

        var payments = await conn.QueryAsync<Payment>(sql,
            new { userId = UserId, yearFrom = $"{y:D4}-01-01", yearTo = $"{y:D4}-12-31", categoryId, limit });
        return Ok(payments.Select(PaymentDto.From));
    }
}
