-- =============================================================
-- Hội An Audio Guide – V001: tạo bảng (PRD Phần XII)
-- Mỗi service "sở hữu" nhóm bảng riêng (PRD mục 8.1):
--   Auth: Admins | Location: LocationCategories, Locations
--   Content: Languages, Narrations, UiTranslations
--   Analytics: VisitSessions, VisitEvents
-- =============================================================

CREATE TABLE dbo.Admins (
  id            INT IDENTITY(1,1) CONSTRAINT PK_Admins PRIMARY KEY,
  username      NVARCHAR(100) NOT NULL CONSTRAINT UQ_Admins_Username UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role          VARCHAR(20)   NOT NULL CONSTRAINT DF_Admins_Role DEFAULT 'EDITOR'
                CONSTRAINT CK_Admins_Role CHECK (role IN ('SUPER_ADMIN','EDITOR')),
  status        VARCHAR(20)   NOT NULL CONSTRAINT DF_Admins_Status DEFAULT 'ACTIVE'
                CONSTRAINT CK_Admins_Status CHECK (status IN ('ACTIVE','DISABLED')),
  last_login_at DATETIME2     NULL,
  created_at    DATETIME2     NOT NULL CONSTRAINT DF_Admins_Created DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2     NOT NULL CONSTRAINT DF_Admins_Updated DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.LocationCategories (
  id          INT IDENTITY(1,1) CONSTRAINT PK_LocationCategories PRIMARY KEY,
  code        VARCHAR(50)   NOT NULL CONSTRAINT UQ_LocationCategories_Code UNIQUE,
  name        NVARCHAR(150) NOT NULL,
  description NVARCHAR(500) NULL,
  sort_order  INT           NOT NULL CONSTRAINT DF_LocationCategories_Sort DEFAULT 0
);
GO

CREATE TABLE dbo.Locations (
  id               INT IDENTITY(1,1) CONSTRAINT PK_Locations PRIMARY KEY,
  code             VARCHAR(100)   NOT NULL CONSTRAINT UQ_Locations_Code UNIQUE,
  name             NVARCHAR(200)  COLLATE Vietnamese_CI_AI NOT NULL,
  description      NVARCHAR(MAX)  NULL,
  address          NVARCHAR(300)  NULL,
  latitude         DECIMAL(9,6)   NULL CONSTRAINT CK_Locations_Lat CHECK (latitude BETWEEN -90 AND 90),
  longitude        DECIMAL(9,6)   NULL CONSTRAINT CK_Locations_Lng CHECK (longitude BETWEEN -180 AND 180),
  category_id      INT            NOT NULL CONSTRAINT FK_Locations_Categories REFERENCES dbo.LocationCategories(id),
  trigger_radius_m INT            NOT NULL CONSTRAINT DF_Locations_Radius DEFAULT 25
                   CONSTRAINT CK_Locations_Radius CHECK (trigger_radius_m BETWEEN 5 AND 200),
  priority         INT            NOT NULL CONSTRAINT DF_Locations_Priority DEFAULT 0,
  opening_hours    NVARCHAR(500)  NULL,
  ticket_price     DECIMAL(12,2)  NULL CONSTRAINT CK_Locations_Price CHECK (ticket_price >= 0),
  image_url        NVARCHAR(1000) NULL,
  is_published     BIT            NOT NULL CONSTRAINT DF_Locations_Published DEFAULT 0,
  deleted_at       DATETIME2      NULL,
  created_at       DATETIME2      NOT NULL CONSTRAINT DF_Locations_Created DEFAULT SYSUTCDATETIME(),
  updated_at       DATETIME2      NOT NULL CONSTRAINT DF_Locations_Updated DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Locations_Published ON dbo.Locations (is_published, deleted_at) INCLUDE (category_id, latitude, longitude);
GO

CREATE TABLE dbo.Languages (
  id             INT IDENTITY(1,1) CONSTRAINT PK_Languages PRIMARY KEY,
  code           VARCHAR(10)   NOT NULL CONSTRAINT UQ_Languages_Code UNIQUE,
  name           NVARCHAR(100) NOT NULL,
  is_default     BIT           NOT NULL CONSTRAINT DF_Languages_Default DEFAULT 0,
  is_enabled     BIT           NOT NULL CONSTRAINT DF_Languages_Enabled DEFAULT 1,
  fallback_order INT           NULL
);
GO
-- Chỉ một ngôn ngữ mặc định
CREATE UNIQUE INDEX UX_Languages_Default ON dbo.Languages (is_default) WHERE is_default = 1;
GO

CREATE TABLE dbo.Narrations (
  id               INT IDENTITY(1,1) CONSTRAINT PK_Narrations PRIMARY KEY,
  location_id      INT            NOT NULL CONSTRAINT FK_Narrations_Locations REFERENCES dbo.Locations(id),
  language_id      INT            NOT NULL CONSTRAINT FK_Narrations_Languages REFERENCES dbo.Languages(id),
  title            NVARCHAR(250)  COLLATE Vietnamese_CI_AI NOT NULL,
  summary          NVARCHAR(500)  COLLATE Vietnamese_CI_AI NULL,
  content          NVARCHAR(MAX)  NOT NULL,
  audio_url        NVARCHAR(1000) NULL,
  audio_duration_s INT            NULL CONSTRAINT CK_Narrations_Duration CHECK (audio_duration_s > 0),
  status           VARCHAR(20)    NOT NULL CONSTRAINT DF_Narrations_Status DEFAULT 'DRAFT'
                   CONSTRAINT CK_Narrations_Status CHECK (status IN ('DRAFT','PUBLISHED')),
  updated_by       INT            NULL,
  updated_at       DATETIME2      NOT NULL CONSTRAINT DF_Narrations_Updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Narrations_Location_Language UNIQUE (location_id, language_id)
);
GO

CREATE TABLE dbo.UiTranslations (
  id          INT IDENTITY(1,1) CONSTRAINT PK_UiTranslations PRIMARY KEY,
  language_id INT            NOT NULL CONSTRAINT FK_UiTranslations_Languages REFERENCES dbo.Languages(id),
  [key]       VARCHAR(150)   NOT NULL,
  value       NVARCHAR(1000) NOT NULL,
  updated_at  DATETIME2      NOT NULL CONSTRAINT DF_UiTranslations_Updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_UiTranslations_Language_Key UNIQUE (language_id, [key])
);
GO

CREATE TABLE dbo.VisitSessions (
  session_id    VARCHAR(64) NOT NULL CONSTRAINT PK_VisitSessions PRIMARY KEY,
  started_at    DATETIME2   NOT NULL,
  last_seen_at  DATETIME2   NOT NULL,
  expires_at    DATETIME2   NOT NULL,
  language_code VARCHAR(10) NULL,
  source        VARCHAR(20) NULL CONSTRAINT CK_VisitSessions_Source CHECK (source IN ('QR','DIRECT')),
  is_simulated  BIT         NOT NULL CONSTRAINT DF_VisitSessions_Simulated DEFAULT 0
);
GO
CREATE INDEX IX_VisitSessions_Expires ON dbo.VisitSessions (expires_at) INCLUDE (is_simulated);
GO

CREATE TABLE dbo.VisitEvents (
  id          BIGINT IDENTITY(1,1) CONSTRAINT PK_VisitEvents PRIMARY KEY,
  session_id  VARCHAR(64) NOT NULL CONSTRAINT FK_VisitEvents_Sessions REFERENCES dbo.VisitSessions(session_id),
  location_id INT         NULL CONSTRAINT FK_VisitEvents_Locations REFERENCES dbo.Locations(id),
  event_type  VARCHAR(50) NOT NULL CONSTRAINT CK_VisitEvents_Type CHECK (event_type IN
              ('QR_SCAN','TOUR_START','LOCATION_VIEW','AUDIO_PLAY','AUDIO_COMPLETE','GEOFENCE_TRIGGER','LANGUAGE_CHANGE')),
  created_at  DATETIME2   NOT NULL CONSTRAINT DF_VisitEvents_Created DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_VisitEvents_Created ON dbo.VisitEvents (created_at) INCLUDE (event_type, location_id, session_id);
GO
