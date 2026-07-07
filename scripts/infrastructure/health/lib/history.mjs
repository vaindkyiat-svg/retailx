/**
 * RetailX V2 Milestone C2 — Health run history
 */

export async function saveHealthRun(client, report) {
  const exists = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'health_runs'
    )`
  );

  if (!exists.rows[0].exists) return null;

  await client.query(
    `INSERT INTO public.health_runs
       (run_id, milestone, environment, trigger, status, health_score, report, completed_at, duration_ms)
     VALUES ($1, 'C2', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (run_id) DO UPDATE SET
       status = EXCLUDED.status,
       health_score = EXCLUDED.health_score,
       report = EXCLUDED.report,
       completed_at = EXCLUDED.completed_at,
       duration_ms = EXCLUDED.duration_ms`,
    [
      report.runId,
      report.environment,
      report.trigger,
      report.status,
      report.healthScore.overall,
      JSON.stringify(report),
      report.generatedAt,
      report.durationMs,
    ]
  );

  return report.runId;
}

export async function getPreviousHealthRun(client, environment) {
  const exists = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'health_runs'
    )`
  );

  if (!exists.rows[0].exists) return null;

  const result = await client.query(
    `SELECT run_id, health_score, status, started_at, report
     FROM public.health_runs
     WHERE environment = $1 AND status IN ('healthy', 'degraded', 'unhealthy')
     ORDER BY started_at DESC
     LIMIT 1 OFFSET 1`,
    [environment]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    runId: row.run_id,
    score: parseFloat(row.health_score),
    status: row.status,
    startedAt: row.started_at,
  };
}

export async function getHealthHistory(client, environment, limit = 10) {
  const result = await client.query(
    `SELECT run_id, health_score, status, trigger, started_at, duration_ms
     FROM public.health_runs
     WHERE environment = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [environment, limit]
  );

  return result.rows.map((r) => ({
    runId: r.run_id,
    score: parseFloat(r.health_score),
    status: r.status,
    trigger: r.trigger,
    startedAt: r.started_at,
    durationMs: r.duration_ms,
  }));
}
