using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using IndustrialML.Api.Data;
using IndustrialML.Api.Models;

[ApiController]
[Route("api/[controller]")]
public class AssetsController : ControllerBase {
    private readonly AppDbContext _db;
    public AssetsController(AppDbContext db) { _db = db; }

    // Returns all assets for the logged-in user's tenant.
    // If no site exists yet, creates one automatically.
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine() {
        var tenantId = GetTenantId();
        if (tenantId == 0) return Unauthorized();

        // Ensure a default site exists for this tenant
        var site = await _db.Sites.FirstOrDefaultAsync(s => s.TenantId == tenantId);
        if (site == null) {
            site = new Site {
                TenantId = tenantId,
                Name     = "Main Plant",
                Industry = "Industrial",
                Location = "Site 1"
            };
            _db.Sites.Add(site);
            await _db.SaveChangesAsync();
        }

        var assets = await _db.Assets
            .Where(a => a.SiteId == site.Id)
            .Select(a => new {
                a.Id, a.Name, a.AssetType,
                Status      = a.Status ?? "normal",
                HealthScore = a.HealthScore ?? 0,
                RulDays     = a.RulDays ?? 0,
                a.LastMaintained, a.NextMaintenance
            }).ToListAsync();

        return Ok(assets);
    }

    // Seeds 4 demo pump assets for the logged-in user's tenant.
    [HttpPost("seed-demo")]
    public async Task<IActionResult> SeedDemo() {
        var tenantId = GetTenantId();
        if (tenantId == 0) return Unauthorized();

        var site = await _db.Sites.FirstOrDefaultAsync(s => s.TenantId == tenantId);
        if (site == null) {
            site = new Site { TenantId = tenantId, Name = "Main Plant", Industry = "Industrial", Location = "Site 1" };
            _db.Sites.Add(site);
            await _db.SaveChangesAsync();
        }

        // Don't double-seed
        if (await _db.Assets.AnyAsync(a => a.SiteId == site.Id))
            return Ok(new { message = "Already seeded" });

        var now  = DateTime.UtcNow;
        var demo = new List<Asset> {
            new Asset {
                SiteId = site.Id, Name = "Influent Pump A", AssetType = "Centrifugal Pump",
                Manufacturer = "Grundfos", ModelNumber = "NK 65-200",
                Status = "warning", HealthScore = 76.4m, RulDays = 147,
                LastMaintained  = now.AddMonths(-8),
                NextMaintenance = now.AddMonths(4)
            },
            new Asset {
                SiteId = site.Id, Name = "Influent Pump B", AssetType = "Centrifugal Pump",
                Manufacturer = "Grundfos", ModelNumber = "NK 65-200",
                Status = "normal", HealthScore = 91.2m, RulDays = 298,
                LastMaintained  = now.AddMonths(-3),
                NextMaintenance = now.AddMonths(9)
            },
            new Asset {
                SiteId = site.Id, Name = "Sludge Pump 1", AssetType = "Progressive Cavity Pump",
                Manufacturer = "Netzsch", ModelNumber = "NEMO BE",
                Status = "critical", HealthScore = 54.7m, RulDays = 38,
                LastMaintained  = now.AddMonths(-14),
                NextMaintenance = now.AddDays(-7)
            },
            new Asset {
                SiteId = site.Id, Name = "Effluent Transfer Pump", AssetType = "Submersible Pump",
                Manufacturer = "Flygt", ModelNumber = "3127",
                Status = "normal", HealthScore = 88.5m, RulDays = 241,
                LastMaintained  = now.AddMonths(-5),
                NextMaintenance = now.AddMonths(7)
            }
        };

        _db.Assets.AddRange(demo);
        await _db.SaveChangesAsync();

        // Add sensor tags for each asset
        foreach (var asset in demo) {
            _db.SensorTags.AddRange(new[] {
                new SensorTag { AssetId = asset.Id, TagName = "flow_rate",     Description = "Flow Rate",           Unit = "L/s",  MinNormal = 30, MaxNormal = 60  },
                new SensorTag { AssetId = asset.Id, TagName = "motor_current", Description = "Motor Current",       Unit = "A",    MinNormal = 15, MaxNormal = 30  },
                new SensorTag { AssetId = asset.Id, TagName = "bearing_temp",  Description = "Bearing Temperature", Unit = "°C",   MinNormal = 40, MaxNormal = 70  },
                new SensorTag { AssetId = asset.Id, TagName = "vibration",     Description = "Vibration",           Unit = "mm/s", MinNormal = 0,  MaxNormal = 4.5m }
            });
        }
        await _db.SaveChangesAsync();

        return Ok(new { message = "Demo data created", assetCount = demo.Count });
    }

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

    private int GetTenantId() {
        var claim = User.FindFirst("tenant_id")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
