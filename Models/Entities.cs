namespace Subly.Models;

// Классы-сущности повторяют таблицы из Database/schema.sql.
// Dapper сопоставляет колонки вида next_payment_date со свойствами NextPaymentDate
// (включено в Program.cs: DefaultTypeMap.MatchNamesWithUnderscores = true).

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public decimal MonthlyBudget { get; set; }
    public string Role { get; set; } = Roles.User;
    public DateTime CreatedAt { get; set; }
}

/// <summary>Роли пользователей</summary>
public static class Roles
{
    public const string User = "user";
    public const string Admin = "admin";
}

public class Category
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "grid";
    public string Color { get; set; } = "#5B4CF0";
    public DateTime CreatedAt { get; set; }
}

public class Subscription
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    /// <summary>monthly или yearly</summary>
    public string BillingPeriod { get; set; } = "monthly";
    public DateTime StartDate { get; set; }
    public DateTime NextPaymentDate { get; set; }
    public string? PaymentMethod { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    // Заполняется при JOIN с categories
    public string? CategoryName { get; set; }
    public string? CategoryIcon { get; set; }
    public string? CategoryColor { get; set; }

    /// <summary>Сколько подписка стоит в пересчёте на месяц.</summary>
    public decimal MonthlyPrice => BillingPeriod == "yearly" ? Math.Round(Price / 12m, 2) : Price;
}

public class Payment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? SubscriptionId { get; set; }
    public int? CategoryId { get; set; }
    public string SubscriptionName { get; set; } = "";
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; }
    public string? PaymentMethod { get; set; }
    public DateTime CreatedAt { get; set; }

    // Заполняется при JOIN с categories
    public string? CategoryName { get; set; }
    public string? CategoryIcon { get; set; }
    public string? CategoryColor { get; set; }
}
