namespace IndustrialML.Api.Models;

public class Tenant {
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Plan { get; set; } = "starter";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Site> Sites { get; set; } = new List<Site>();
}
public class Site {
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string Name { get; set; } = "";
    public string? Industry { get; set; }
    public string? Location { get; set; }
    public string Timezone { get; set; } = "UTC";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Tenant Tenant { get; set; } = null!;
    public ICollection<Asset> Assets { get; set; } = new List<Asset>();
}
public class Asset {
    public int Id { get; set; }
    public int SiteId { get; set; }
    public string Name { get; set; } = "";
    public string AssetType { get; set; } = "";
    public string? Manufacturer { get; set; }
    public string? ModelNumber { get; set; }
    public string? Status { get; set; } = "normal";
    public decimal? HealthScore { get; set; }
    public int? RulDays { get; set; }
    public DateTime? LastMaintained { get; set; }
    public DateTime? NextMaintenance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Site Site { get; set; } = null!;
    public ICollection<SensorTag> Tags { get; set; } = new List<SensorTag>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}
public class SensorTag {
    public int Id { get; set; }
    public int AssetId { get; set; }
    public string TagName { get; set; } = "";
    public string? Description { get; set; }
    public string? Unit { get; set; }
    public decimal? MinNormal { get; set; }
    public decimal? MaxNormal { get; set; }
    public Asset Asset { get; set; } = null!;
    public ICollection<SensorReading> Readings { get; set; } = new List<SensorReading>();
}
public class SensorReading {
    public long Id { get; set; }

    public int TagId { get; set; }

    public decimal Value { get; set; }

    public byte Quality { get; set; } = 1;

    public DateTime RecordedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SensorTag Tag { get; set; } = null!;
}
public class Alert {
    public long Id { get; set; }
    public int AssetId { get; set; }
    public string AlertType { get; set; } = "";
    public string Severity { get; set; } = "warning";
    public string Message { get; set; } = "";
    public bool Acknowledged { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Asset Asset { get; set; } = null!;
}
public class Prediction {
    public long Id { get; set; }
    public int AssetId { get; set; }
    public string ModelName { get; set; } = "";
    public string PredictionType { get; set; } = "";
    public decimal PredictedValue { get; set; }
    public decimal Confidence { get; set; }
    public string? TopFactors { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public Asset Asset { get; set; } = null!;
}

public class User {
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? FullName { get; set; }
    public string Role { get; set; } = "engineer";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Tenant Tenant { get; set; } = null!;
}