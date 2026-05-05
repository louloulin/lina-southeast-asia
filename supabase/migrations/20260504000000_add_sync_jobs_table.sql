-- LINA-31: sync_jobs table for 1688 pipeline health monitoring
-- Tracks each sync run: INSERT when job starts, UPDATE when job completes or fails.
-- The health-check cron uses this to determine if sync needs to be restarted.

CREATE TABLE IF NOT EXISTS sync_jobs (
  id            TEXT PRIMARY KEY,  -- cuid()
  job_type      TEXT NOT NULL,    -- '1688_sync'
  status        TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

-- Index for fast health-check queries
CREATE INDEX idx_sync_jobs_job_type_started_at ON sync_jobs(job_type, started_at DESC);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);