-- =============================================================
-- Hội An Audio Guide – V001: tạo bảng (PRD Phần XII)
-- Mỗi service "sở hữu" nhóm bảng riêng (PRD mục 8.1):
--   Location: LocationCategories, Locations
--   Content: Languages, Narrations
-- =============================================================

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
