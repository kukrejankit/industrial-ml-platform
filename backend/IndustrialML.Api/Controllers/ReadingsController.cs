using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using IndustrialML.Api.Data;
using IndustrialML.Api.Models;

[ApiController]
[Route("api/[controller]")]
public class ReadingsController : ControllerBase {
    private readonly AppDbContext _db;
    private readonly IHubContext<SensorHub> _hub;
    private readonly IHttpClientFactory _http;
    private readonly IServiceScopeFactory _scopeFactory;

    public ReadingsController(
        AppDbContext db,
        IHubContext<SensorHub> hub,
        IHttpClientFactory http,
        IServiceScopeFactory scopeFactory) {
        _db           = db;
        _hub          = hub;
        _http         = http;
        _scopeFactory = scopeFactory;
    }

    [HttpPost]
    public async Task<IActionResult> Ingest(
        [FromBody] List<ReadingDto> readings) {

        var entities = readings.Select(r => new SensorReading {
            TagId      = r.TagId,
            Value      = r.Value,
            RecordedAt = r.RecordedAt ?? DateTime.UtcNow
        }).ToList();

        _db.SensorReadings.AddRange(entities);
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("NewReadings", readings);

        // Get unique tag IDs from readings
        var tagIds = readings.Select(r => r.TagId)
                             .Distinct().ToList();
        Console.WriteLine(
            $"Tags received: {string.Join(",", tagIds)}");

        // Look up asset IDs for these tags
        var tags = await _db.SensorTags
            .AsNoTracking()
            .Where(t => tagIds.Contains(t.Id))
            .ToListAsync();

        var assetIds = tags.Select(t => t.AssetId)
                           .Distinct().ToList();
        Console.WriteLine(
            $"Assets found: {string.Join(",", assetIds)}");

        // Capture for background tasks
        var scopeFactory = _scopeFactory;
        var hub          = _hub;
        var http         = _http;

        // Run ML for EACH asset separately
        foreach (var assetId in assetIds) {
            var id = assetId;
            Console.WriteLine($"Queuing ML for asset {id}");
            _ = Task.Run(() =>
                CallMlForAsset(id, scopeFactory, hub, http));
        }

        return Ok(new { saved = entities.Count });
    }

    [HttpGet("{tagId}")]
    public async Task<IActionResult> GetHistory(
        int tagId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 500) {

        var q = _db.SensorReadings
            .Where(r => r.TagId == tagId);
        if (from.HasValue)
            q = q.Where(r => r.RecordedAt >= from);
        if (to.HasValue)
            q = q.Where(r => r.RecordedAt <= to);

        var data = await q
            .OrderByDescending(r => r.RecordedAt)
            .Take(limit)
            .Select(r => new {
                r.RecordedAt,
                r.Value,
                r.Quality
            })
            .ToListAsync();

        return Ok(data);
    }

    private static async Task CallMlForAsset(
        int assetId,
        IServiceScopeFactory scopeFactory,
        IHubContext<SensorHub> hub,
        IHttpClientFactory httpFactory) {

        try {
            using var scope = scopeFactory.CreateScope();
            var db     = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();
            var client = httpFactory.CreateClient();

            Console.WriteLine(
                $"Fetching readings for asset {assetId}");

            // Fetch last 200 readings for THIS asset only
            var historicalReadings = await db.SensorReadings
                .Include(r => r.Tag)
                .Where(r => r.Tag.AssetId == assetId)
                .OrderByDescending(r => r.RecordedAt)
                .Take(200)
                .Select(r => new {
                    tagId      = r.TagId,
                    value      = (float)r.Value,
                    recordedAt = r.RecordedAt
                        .ToString("yyyy-MM-ddTHH:mm:ss")
                })
                .ToListAsync();

            Console.WriteLine(
                $"Asset {assetId}: {historicalReadings.Count} readings");

            if (historicalReadings.Count < 10) {
                Console.WriteLine(
                    $"Asset {assetId}: not enough data");
                return;
            }

            var payload = new {
                assetId  = assetId,
                readings = historicalReadings
            };

            var mlBaseUrl = Environment.GetEnvironmentVariable("MlService__BaseUrl")
                    ?? "https://industrial-ml-service.azurewebsites.net/predict/anomaly";
            var response = await client.PostAsJsonAsync(
                        $"{mlBaseUrl}/predict/anomaly", payload);

            Console.WriteLine(
                $"Asset {assetId} ML response: {response.StatusCode}");

            if (response.IsSuccessStatusCode) {
                var options =
                    new System.Text.Json.JsonSerializerOptions {
                        PropertyNameCaseInsensitive = true
                    };
                var result = await System.Text.Json.JsonSerializer
                    .DeserializeAsync<AnomalyResultRaw>(
                        await response.Content.ReadAsStreamAsync(),
                        options);

                if (result != null && result.current_health > 0) {
                    var asset = await db.Assets.FindAsync(assetId);
                    if (asset != null) {
                        asset.HealthScore =
                            (decimal)result.current_health;
                        asset.Status =
                            result.alert_level ?? "normal";
                        await db.SaveChangesAsync();

                        await hub.Clients.All.SendAsync(
                            "AssetUpdated", new {
                                assetId,
                                healthScore = result.current_health,
                                status      = result.alert_level
                            });

                        Console.WriteLine(
                            $"Asset {assetId} updated: " +
                            $"{result.current_health:F1}% " +
                            $"[{result.alert_level}]");
                    }
                }
            } else {
                var error = await response.Content
                    .ReadAsStringAsync();
                Console.WriteLine(
                    $"Asset {assetId} ML error: {error}");
            }
        } catch (Exception ex) {
            Console.WriteLine(
                $"Asset {assetId} failed: {ex.Message}");
        }
    }
}
