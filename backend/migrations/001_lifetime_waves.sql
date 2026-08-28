-- Keep the legacy column for production compatibility, but allow new lifetime
-- waves to leave it empty. Application logic must not use week_start anymore.
ALTER TABLE live_schedule_waves
    MODIFY COLUMN week_start DATE NULL;
