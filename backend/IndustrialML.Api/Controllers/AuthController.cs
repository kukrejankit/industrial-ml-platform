using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using IndustrialML.Api.Data;
using IndustrialML.Api.Models;
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase {
    private readonly AppDbContext _db;
    private readonly IConfiguration _cfg;
    public AuthController(AppDbContext db, IConfiguration cfg) {
        _db = db; _cfg = cfg;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto) {
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (user == null ||
            !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials");
        return Ok(new {
            token = GenerateToken(user),
            user  = new { user.Id, user.Email, user.FullName,
                          user.Role, user.TenantId }
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto) {
        if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
            return BadRequest("Email already registered");
        var tenant = new Tenant {
            Name = dto.CompanyName,
            Slug = dto.CompanyName.ToLower().Replace(" ","-")
        };
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync();
        _db.Users.Add(new User {
            TenantId     = tenant.Id,
            Email        = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FullName     = dto.FullName,
            Role         = "admin"
        });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Account created" });
    }

    private string GenerateToken(User user) {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(
            key, SecurityAlgorithms.HmacSha256);
        var claims = new[] {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("tenant_id", user.TenantId.ToString())
        };
        return new JwtSecurityTokenHandler().WriteToken(
            new JwtSecurityToken(
                issuer:   _cfg["Jwt:Issuer"],
                audience: _cfg["Jwt:Audience"],
                claims:   claims,
                expires:  DateTime.UtcNow.AddHours(24),
                signingCredentials: creds));
    }
}
public record LoginDto(string Email, string Password);
public record RegisterDto(string Email, string Password,
    string FullName, string CompanyName);