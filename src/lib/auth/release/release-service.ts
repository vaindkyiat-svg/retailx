/**
 * RetailX V2 Milestone D1.4A — Release dashboard service
 */

import { getAllPilotShopRecords } from '../pilot/pilot-shop-client';
import { authIncidentEngine } from './auth-incident-engine';
import { collectReleaseMetrics, type ReleaseMetricsInput } from './ReleaseMetrics';
import {
  buildReleaseDashboardReport,
  toReleaseHtml,
  toReleaseMarkdown,
} from './ReleaseReport';
import { releaseHistoryStore } from './release-history';
import { rolloutController } from './RolloutController';

export async function getReleaseDashboardReport(metricsInput?: ReleaseMetricsInput) {
  const metrics = collectReleaseMetrics(metricsInput ?? {});
  const pilotShops = await getAllPilotShopRecords();
  const report = buildReleaseDashboardReport({
    metrics,
    pilotShops,
    lastDecision: rolloutController.getLastDecision(),
    openIncidents: authIncidentEngine.getOpenIncidents(),
    recentHistory: releaseHistoryStore.getRecent(20),
  });

  return {
    json: report,
    markdown: toReleaseMarkdown(report),
    html: toReleaseHtml(report),
  };
}

export async function evaluateReleaseRollout(
  options?: Parameters<typeof rolloutController.evaluate>[0]
) {
  return rolloutController.evaluate(options);
}
