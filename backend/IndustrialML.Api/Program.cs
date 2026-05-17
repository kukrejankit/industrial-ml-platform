using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using IndustrialML.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        ServerVersion.AutoDetect(
            builder.Configuration.GetConnectionString("DefaultConnection"))));

var key = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt => {
        opt.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(key)),
            ValidIssuer   = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"]
        };
    });

builder.Services.AddCors(opt => opt.AddPolicy("AllowAngular",
    p => p.SetIsOriginAllowed(_ => true)
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()));

builder.Services.AddSignalR();
builder.Services.AddHttpClient();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<MlClientService>();
var app = builder.Build();
app.UseExceptionHandler(errorApp => errorApp.Run(async ctx => {
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    var err = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    if (err != null)
        await ctx.Response.WriteAsync($"{{\"error\":\"{err.Error.Message.Replace("\"","'")}\"}}");
}));

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
catch (Exception ex)
{
    Console.WriteLine($"Migration failed: {ex.Message}");
}
app.UseSwagger(); app.UseSwaggerUI();
app.UseRouting();
app.UseCors("AllowAngular");
app.UseAuthentication(); app.UseAuthorization();
app.MapControllers();
app.MapHub<SensorHub>("/hubs/sensors");
app.Run();
