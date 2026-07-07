/**
 * RetailX V2 Milestone C3 — Performance & resource metrics
 */

export function snapshotMemory() {
  const m = process.memoryUsage();
  return {
    heapUsedMb: round(m.heapUsed / 1024 / 1024),
    heapTotalMb: round(m.heapTotal / 1024 / 1024),
    rssMb: round(m.rss / 1024 / 1024),
    externalMb: round(m.external / 1024 / 1024),
  };
}

export function createMetricsCollector() {
  const phases = [];
  let memStart = snapshotMemory();

  return {
    startPhase(name) {
      return {
        name,
        startedAt: Date.now(),
        memoryBefore: snapshotMemory(),
      };
    },

    endPhase(ctx, extra = {}) {
      const durationMs = Date.now() - ctx.startedAt;
      const memoryAfter = snapshotMemory();
      const entry = {
        name: ctx.name,
        durationMs,
        memoryBefore: ctx.memoryBefore,
        memoryAfter,
        memoryDeltaMb: round(memoryAfter.heapUsedMb - ctx.memoryBefore.heapUsedMb),
        ...extra,
      };
      phases.push(entry);
      return entry;
    },

    getReport() {
      const memEnd = snapshotMemory();
      return {
        phases,
        totalDurationMs: phases.reduce((s, p) => s + p.durationMs, 0),
        memory: {
          start: memStart,
          end: memEnd,
          peakHeapMb: Math.max(...phases.map((p) => p.memoryAfter.heapUsedMb), memStart.heapUsedMb),
        },
      };
    },
  };
}

export async function collectDatabaseStats(client) {
  const counts = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public.shops) AS shops,
      (SELECT count(*)::int FROM public.user_profiles) AS user_profiles,
      (SELECT count(*)::int FROM public.products) AS products,
      (SELECT count(*)::int FROM public.orders) AS orders,
      (SELECT count(*)::int FROM public.memberships) AS memberships,
      (SELECT count(*)::int FROM public.branches) AS branches,
      (SELECT count(*)::int FROM public.warehouses) AS warehouses,
      (SELECT count(*)::int FROM public.subscriptions) AS subscriptions
  `);

  let connections = { active: 0 };
  try {
    const conn = await client.query(
      `SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()`
    );
    connections.active = conn.rows[0].active;
  } catch {
    // ignore on restricted roles
  }

  return {
    rowCounts: counts.rows[0],
    connections,
    collectedAt: new Date().toISOString(),
  };
}

export async function measureQuery(client, name, sql, params = []) {
  const start = Date.now();
  const result = await client.query(sql, params);
  return {
    name,
    durationMs: Date.now() - start,
    rowCount: result.rowCount ?? result.rows.length,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
