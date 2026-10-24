using Subly.Models;
using Subly.Services;

namespace Subly.Dtos;

// ---------- Запросы ----------

public class RegisterRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public class UpdateProfileRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public decimal MonthlyBudget { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public class DeleteAccountRequest
{
    public string Password { get; set; } = "";
    /// <summary>Пользователь должен ввести слово «УДАЛИТЬ».</summary>
    public string Confirmation { get; set; } = "";
}

public class CategoryRequest
{
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "grid";
    public string Color { get; set; } = "#5B4CF0";
}

public class SubscriptionRequest
{
    public string Name { get; set; } = "";
    public int CategoryId { get; set; }
    public decimal Price { get; set; }
    /// <summary>monthly или yearly</summary>
    public string BillingPeriod { get; set; } = "monthly";
    /// <summary>Дата следующего списания в формате yyyy-MM-dd</summary>
    public string NextPaymentDate { get; set; } = "";
    public string? PaymentMethod { get; set; }
    public bool IsActive { get; set; } = true;
}

// ---------- Ответы ----------

public record UserDto(int Id, string Name, string Email, decimal MonthlyBudget, string Role, string CreatedAt)
{
    public static UserDto From(User u) =>
        new(u.Id, u.Name, u.Email, u.MonthlyBudget, u.Role, Clock.Format(u.CreatedAt));
}

public record AuthResponse(string Token, UserDto User);

public record CategoryDto(int Id, string Name, string Icon, string Color, int SubscriptionsCount, decimal MonthlyTotal);

public record SubscriptionDto(
    int Id,
    string Name,
    int CategoryId,
    string CategoryName,
    string CategoryIcon,
    string CategoryColor,
    decimal Price,
    decimal MonthlyPrice,
    string BillingPeriod,
    string StartDate,
    string NextPaymentDate,
    int DaysUntilPayment,
    string? PaymentMethod,
    bool IsActive)
{
    public static SubscriptionDto From(Subscription s) => new(
        s.Id, s.Name, s.CategoryId,
        s.CategoryName ?? "", s.CategoryIcon ?? "grid", s.CategoryColor ?? "#5B4CF0",
        s.Price, s.MonthlyPrice, s.BillingPeriod,
        Clock.Format(s.StartDate), Clock.Format(s.NextPaymentDate),
        (s.NextPaymentDate.Date - Clock.Today).Days,
        s.PaymentMethod, s.IsActive);
}

public record PaymentDto(
    int Id,
    int? SubscriptionId,
    string SubscriptionName,
    string? CategoryName,
    string? CategoryIcon,
    string? CategoryColor,
    decimal Amount,
    string PaidAt,
    string? PaymentMethod)
{
    public static PaymentDto From(Payment p) => new(
        p.Id, p.SubscriptionId, p.SubscriptionName,
        p.CategoryName, p.CategoryIcon, p.CategoryColor,
        p.Amount, Clock.Format(p.PaidAt), p.PaymentMethod);
}

public record ErrorResponse(string Message);
