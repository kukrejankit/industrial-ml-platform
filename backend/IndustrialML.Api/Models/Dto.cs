namespace IndustrialML.Api.Models;

public record ReadingDto(int TagId, decimal Value, DateTime? RecordedAt);
public record AnomalyResult(float CurrentHealth, string AlertLevel);
public record FactorItem(string Feature, double Importance);
public record RulResult(int RulDays, float Confidence,
                        List<FactorItem> TopFactors);
public record LoginDto(string Email, string Password);
public record RegisterDto(string Email, string Password,
    string FullName, string CompanyName);

public class AnomalyResultRaw {
    public float current_health { get; set; }
    public string? alert_level { get; set; } = "normal";
}
