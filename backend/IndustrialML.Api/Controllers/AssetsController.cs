using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IndustrialML.Api.Data;
using IndustrialML.Api.Models;

[ApiController]
[Route("api/[controller]")]
public class AssetsController : ControllerBase {
    private readonly AppDbContext _db;
    public AssetsController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int siteId) {
        var assets = await _db.Assets
            .Where(a => a.SiteId == siteId)
            .Select(a => new {
                a.Id, a.Name, a.AssetType, Status = a.Status ?? "normal",
                HealthScore = a.HealthScore ?? 0, 
                RulDays = a.RulDays ?? 0,
                a.LastMaintained, a.NextMaintenance
            }).ToListAsync();
        return Ok(assets);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(int id) {
        var asset = await _db.Assets
            .Include(a => a.Tags)
            .FirstOrDefaultAsync(a => a.Id == id);
        return asset == null ? NotFound() : Ok(asset);
    }
}