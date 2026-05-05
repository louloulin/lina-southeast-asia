-- Service health check audit log
-- Persists results from the general-health cron (LINA-159)
CREATE TABLE IF NOT EXISTS service_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL,         -- 'database' | 'sync_pipeline' | 'api_self'
  status TEXT NOT NULL,             -- 'healthy' | 'degraded' | 'unhealthy'
  message TEXT,
  response_time_ms INTEGER,
  recovery_action TEXT,             -- e.g. 'killed_stuck_job', 'triggered_sync'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep recent logs fast, old logs trimmed
CREATE INDEX IF NOT EXISTS idx_health_logs_created_at ON service_health_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_check_type ON service_health_logs (check_type);
