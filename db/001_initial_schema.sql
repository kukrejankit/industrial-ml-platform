USE industrial_ml;

-- TENANTS (one row per company/customer)
CREATE TABLE tenants (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(100) UNIQUE NOT NULL,
  plan       ENUM('starter','professional','enterprise') DEFAULT 'starter',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- USERS
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255),
  role          ENUM('admin','engineer','viewer') DEFAULT 'engineer',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- SITES (a plant or facility)
CREATE TABLE sites (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id  INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  industry   VARCHAR(100),
  location   VARCHAR(255),
  timezone   VARCHAR(100) DEFAULT 'UTC',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ASSETS (pump, compressor, blower, motor etc.)
CREATE TABLE assets (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  site_id          INT NOT NULL,
  name             VARCHAR(255) NOT NULL,
  asset_type       VARCHAR(100) NOT NULL,
  manufacturer     VARCHAR(255),
  model_number     VARCHAR(255),
  rated_power_kw   DECIMAL(10,2),
  status           ENUM('normal','warning','critical','offline') DEFAULT 'normal',
  health_score     DECIMAL(5,2),
  rul_days         INT,
  last_maintained  DATE,
  next_maintenance DATE,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- SENSOR TAGS (describes each measurement point on an asset)
CREATE TABLE sensor_tags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  asset_id    INT NOT NULL,
  tag_name    VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  unit        VARCHAR(50),
  min_normal  DECIMAL(12,4),
  max_normal  DECIMAL(12,4),
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  UNIQUE KEY (asset_id, tag_name)
);

-- SENSOR READINGS (time-series core of the system)
CREATE TABLE sensor_readings (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tag_id      INT NOT NULL,
  value       DECIMAL(15,6) NOT NULL,
  quality     TINYINT DEFAULT 1,
  recorded_at DATETIME(3) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES sensor_tags(id),
  INDEX idx_tag_time (tag_id, recorded_at),   -- critical for performance
  INDEX idx_recorded (recorded_at)
) ENGINE=InnoDB;

-- PREDICTIONS (ML output stored here)
CREATE TABLE predictions (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  asset_id        INT NOT NULL,
  model_name      VARCHAR(100),
  prediction_type VARCHAR(50),
  predicted_value DECIMAL(12,4),
  confidence      DECIMAL(5,4),
  top_factors     JSON,
  generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  INDEX idx_asset_time (asset_id, generated_at)
);

-- ALERTS
CREATE TABLE alerts (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  asset_id       INT NOT NULL,
  alert_type     ENUM('anomaly','threshold','prediction','manual') NOT NULL,
  severity       ENUM('info','warning','critical') NOT NULL,
  message        TEXT NOT NULL,
  acknowledged   BOOLEAN DEFAULT FALSE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  INDEX idx_asset_alerts (asset_id, created_at)
);

-- MAINTENANCE LOGS
CREATE TABLE maintenance_logs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  asset_id         INT NOT NULL,
  maintenance_type ENUM('preventive','corrective','predictive','inspection'),
  description      TEXT,
  performed_by     VARCHAR(255),
  cost_usd         DECIMAL(10,2),
  downtime_hours   DECIMAL(6,2),
  performed_at     DATETIME NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- SEED DATA
INSERT INTO tenants (name, slug, plan)
  VALUES ('Demo Plant Co', 'demo', 'professional');

INSERT INTO sites (tenant_id, name, industry, location, timezone)
  VALUES (1, 'Water Treatment Plant Alpha',
          'water_treatment', 'Mumbai, India', 'Asia/Kolkata');

INSERT INTO assets
  (site_id, name, asset_type, manufacturer, model_number,
   rated_power_kw, health_score, status)
VALUES
  (1,'Pump P-101','pump','Grundfos','CR 45-3',22.0,87.5,'normal'),
  (1,'Pump P-102','pump','Grundfos','CR 45-3',22.0,62.3,'warning'),
  (1,'Blower B-201','blower','Atlas Copco','ZS 55+',55.0,91.0,'normal'),
  (1,'Compressor C-301','compressor','Ingersoll Rand','UP6-15',11.0,44.1,'critical');

-- Sensor tags for Pump P-101 (asset_id = 1)
INSERT INTO sensor_tags
  (asset_id,tag_name,description,unit,min_normal,max_normal)
VALUES
  (1,'inlet_pressure', 'Suction pressure',         'bar',  0.5, 2.0),
  (1,'outlet_pressure','Discharge pressure',        'bar',  3.0, 7.0),
  (1,'flow_rate',      'Flow rate',                 'm3/h',10.0,45.0),
  (1,'motor_temp',     'Motor winding temperature', 'degC',20.0,85.0),
  (1,'vibration',      'Bearing vibration RMS',     'mm/s', 0.0, 4.5),
  (1,'power_kw',       'Active power draw',         'kW',   5.0,25.0);
