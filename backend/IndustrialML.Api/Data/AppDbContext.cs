using Microsoft.EntityFrameworkCore;

using IndustrialML.Api.Models;

 

namespace IndustrialML.Api.Data;

 

public class AppDbContext : DbContext {

    public AppDbContext(DbContextOptions<AppDbContext> options)

        : base(options) {}

 

    public DbSet<Tenant>        Tenants        => Set<Tenant>();

    public DbSet<Site>          Sites          => Set<Site>();

    public DbSet<Asset>         Assets         => Set<Asset>();

    public DbSet<SensorTag>     SensorTags     => Set<SensorTag>();

    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();

    public DbSet<Alert>         Alerts         => Set<Alert>();

    public DbSet<Prediction>    Predictions    => Set<Prediction>();

    public DbSet<User>          Users          => Set<User>();

 

    protected override void OnModelCreating(ModelBuilder mb) {

 

    mb.Entity<Tenant>(e => {

        e.ToTable("tenants");

        e.Property(t => t.CreatedAt).HasColumnName("created_at");

    });

 

    mb.Entity<Site>(e => {

        e.ToTable("sites");

        e.Property(s => s.TenantId).HasColumnName("tenant_id");

        e.Property(s => s.CreatedAt).HasColumnName("created_at");

    });

 

    mb.Entity<Asset>(e => {

        e.ToTable("assets");

        e.Property(a => a.SiteId).HasColumnName("site_id");

        e.Property(a => a.AssetType).HasColumnName("asset_type");

        e.Property(a => a.HealthScore).HasColumnName("health_score").HasPrecision(5,2);

        e.Property(a => a.RulDays).HasColumnName("rul_days");

        e.Property(a => a.LastMaintained).HasColumnName("last_maintained");

        e.Property(a => a.NextMaintenance).HasColumnName("next_maintenance");

        e.Property(a => a.CreatedAt).HasColumnName("created_at");

        e.Property(a => a.Manufacturer).HasColumnName("manufacturer");

        e.Property(a => a.ModelNumber).HasColumnName("model_number");

    });

 

    mb.Entity<SensorTag>(e => {

        e.ToTable("sensor_tags");

        e.Property(t => t.AssetId).HasColumnName("asset_id");

        e.Property(t => t.TagName).HasColumnName("tag_name");

        e.Property(t => t.MinNormal).HasColumnName("min_normal");

        e.Property(t => t.MaxNormal).HasColumnName("max_normal");

    });

 

    mb.Entity<SensorReading>(e => {

        e.ToTable("sensor_readings");

        e.Property(r => r.TagId).HasColumnName("tag_id");

        e.Property(r => r.RecordedAt).HasColumnName("recorded_at");

        e.Property(r => r.CreatedAt).HasColumnName("created_at");

        e.Property(r => r.Value).HasPrecision(15, 6);

        e.HasIndex(r => new { r.TagId, r.RecordedAt });

    });

 

    mb.Entity<Alert>(e => {

        e.ToTable("alerts");

        e.Property(a => a.AssetId).HasColumnName("asset_id");

        e.Property(a => a.AlertType).HasColumnName("alert_type");

        e.Property(a => a.CreatedAt).HasColumnName("created_at");

    });

 

    mb.Entity<Prediction>(e => {

        e.ToTable("predictions");

        e.Property(p => p.AssetId).HasColumnName("asset_id");

        e.Property(p => p.ModelName).HasColumnName("model_name");

        e.Property(p => p.PredictionType).HasColumnName("prediction_type");

        e.Property(p => p.PredictedValue).HasColumnName("predicted_value");

        e.Property(p => p.GeneratedAt).HasColumnName("generated_at");

        e.Property(p => p.TopFactors).HasColumnName("top_factors");

    });

 

    mb.Entity<User>(e => {

        e.ToTable("users");

        e.Property(u => u.TenantId).HasColumnName("tenant_id");

        e.Property(u => u.PasswordHash).HasColumnName("password_hash");

        e.Property(u => u.FullName).HasColumnName("full_name");

        e.Property(u => u.CreatedAt).HasColumnName("created_at");

    });

}

}