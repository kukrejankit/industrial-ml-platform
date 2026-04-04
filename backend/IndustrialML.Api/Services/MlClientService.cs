using Microsoft.AspNetCore.Mvc;

using Microsoft.EntityFrameworkCore;

using Microsoft.AspNetCore.SignalR;

using IndustrialML.Api.Data;

using IndustrialML.Api.Models;
public class MlClientService {
    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly IHubContext<SensorHub> _hub;
    private readonly string _mlBase;

    public MlClientService(IHttpClientFactory f, AppDbContext db,
        IHubContext<SensorHub> hub, IConfiguration cfg) {
        _http = f.CreateClient(); _db = db; _hub = hub;
        _mlBase = cfg["MlService:BaseUrl"] ??
                  "http://localhost:8001";
    }

    public async Task RunPredictions(int assetId) {
        var readings = await _db.SensorReadings
            .Include(r => r.Tag)
            .Where(r => r.Tag.AssetId == assetId)
            .OrderByDescending(r => r.RecordedAt).Take(500)
            .Select(r => new {
                tagId      = r.TagId,
                value      = (float)r.Value,
                recordedAt = r.RecordedAt.ToString("o")
            }).ToListAsync();

        if (readings.Count < 10) return;
        var payload = new { assetId, readings };

        // Anomaly / health score
        var ar = await _http.PostAsJsonAsync(
            $"{_mlBase}/predict/anomaly", payload);
        if (ar.IsSuccessStatusCode) {
            var res = await ar.Content
                .ReadFromJsonAsync<AnomalyResult>();
            var asset = await _db.Assets.FindAsync(assetId);
            if (asset != null && res != null) {
                asset.HealthScore = (decimal)res.CurrentHealth;
                asset.Status      = res.AlertLevel;
                if (res.AlertLevel != "normal")
                    _db.Alerts.Add(new Alert {
                        AssetId   = assetId,
                        AlertType = "anomaly",
                        Severity  = res.AlertLevel,
                        Message   = $"Health dropped to {res.CurrentHealth:F0}%"
                    });
                await _db.SaveChangesAsync();
                await _hub.Clients.All.SendAsync("AssetUpdated", new {
                    assetId,
                    healthScore = res.CurrentHealth,
                    status      = res.AlertLevel
                });
            }
        }

        // RUL prediction
        var rr = await _http.PostAsJsonAsync(
            $"{_mlBase}/predict/rul", payload);
        if (rr.IsSuccessStatusCode) {
            var res = await rr.Content.ReadFromJsonAsync<RulResult>();
            if (res != null) {
                var asset = await _db.Assets.FindAsync(assetId);
                if (asset != null) {
                    asset.RulDays = res.RulDays;
                    if (res.RulDays < 30 && asset.NextMaintenance == null)
                        asset.NextMaintenance =
                            DateTime.UtcNow.AddDays(res.RulDays - 5);
                }
                _db.Predictions.Add(new Prediction {
                    AssetId        = assetId,
                    ModelName      = "xgboost_rul_v1",
                    PredictionType = "rul",
                    PredictedValue = (decimal)res.RulDays,
                    Confidence     = (decimal)res.Confidence,
                    TopFactors     = System.Text.Json.JsonSerializer
                        .Serialize(res.TopFactors)
                });
                await _db.SaveChangesAsync();
            }
        }
    }
}
//public record AnomalyResult(float CurrentHealth, string AlertLevel);
public record FactorItem(string Feature, double Importance);
public record RulResult(int RulDays, float Confidence,
                        List<FactorItem> TopFactors);