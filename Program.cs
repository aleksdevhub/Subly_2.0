using Subly.Models;
using System.Reflection;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Subly.Data;
using Subly.Dtos;
using Subly.Services;

var builder = WebApplication.CreateBuilder(args);

// Хостинги (Render и др.) передают порт через переменную PORT
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Колонки snake_case (next_payment_date) ↔ свойства PascalCase (NextPaymentDate)
DefaultTypeMap.MatchNamesWithUnderscores = true;
Clock.Configure(builder.Configuration["App:TimeZone"]);

builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<TokenService>();

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(o =>
    {
        // Ошибки валидации отдаём в том же формате, что и остальные: { "message": "..." }
        o.InvalidModelStateResponseFactory = ctx =>
            new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new ErrorResponse("Некорректные данные запроса"));
    });

// ---------- Аутентификация по JWT ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Issuer"],
            IssuerSigningKey = TokenService.GetKey(builder.Configuration),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
// Политика "Admin": методы с [Authorize(Policy = "Admin")] доступны только администратору
builder.Services.AddAuthorization(options =>
    options.AddPolicy("Admin", policy => policy.RequireRole(Roles.Admin)));

// ---------- Swagger: документация API на /swagger ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Subly API",
        Version = "v1",
        Description = "API сервиса для отслеживания подписок. Чтобы вызывать защищённые методы, " +
                      "выполните /api/auth/login и вставьте токен в Authorize."
    });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Вставьте токен из ответа /api/auth/login"
    });
    o.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
    var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
    if (File.Exists(xml)) o.IncludeXmlComments(xml);
});

var app = builder.Build();

// Создаём таблицы и демо-данные
await DbInitializer.InitializeAsync(app.Services, app.Configuration, app.Logger);

// Любая необработанная ошибка в API → JSON { message }
app.UseExceptionHandler(errorApp => errorApp.Run(async ctx =>
{
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await ctx.Response.WriteAsJsonAsync(new ErrorResponse("Внутренняя ошибка сервера. Попробуйте ещё раз."));
}));

app.UseSwagger();
app.UseSwaggerUI(o => o.DocumentTitle = "Subly API");

// Сайт (HTML/CSS/JS) лежит в папке wwwroot
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    // Браузер каждый раз сверяет файлы с сервером — после обновления сайта не останется старых версий
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache"
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
