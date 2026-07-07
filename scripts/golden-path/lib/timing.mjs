/**
 * RetailX V2 Sprint E2 — Step timing and result tracking
 */

export class StepTracker {
  constructor() {
    /** @type {import('./types.mjs').GoldenPathStep[]} */
    this.steps = [];
  }

  /**
   * @template T
   * @param {string} name
   * @param {() => Promise<T>} fn
   * @param {string} [recommendation]
   */
  async run(name, fn, recommendation) {
    const start = Date.now();
    /** @type {import('./types.mjs').GoldenPathStep} */
    const entry = {
      step: name,
      result: 'pass',
      durationMs: 0,
      errors: [],
      warnings: [],
      recommendation: recommendation ?? null,
    };

    try {
      const value = await fn();
      entry.durationMs = Date.now() - start;
      this.steps.push(entry);
      return value;
    } catch (err) {
      entry.result = 'fail';
      entry.durationMs = Date.now() - start;
      entry.errors.push(err instanceof Error ? err.message : String(err));
      this.steps.push(entry);
      throw err;
    }
  }

  /**
   * @param {string} stepName
   * @param {string} warning
   */
  warn(stepName, warning) {
    const step = this.steps.find((s) => s.step === stepName);
    if (step) {
      step.warnings.push(warning);
    }
  }

  getPerformance() {
    const find = (prefix) =>
      this.steps.find((s) => s.step.toLowerCase().includes(prefix.toLowerCase()))?.durationMs ?? null;

    return {
      provisioningMs: find('provision'),
      loginMs: find('owner logs in') ?? find('owner login'),
      dashboardMs: find('dashboard'),
      checkoutMs: find('checkout'),
      reportMs: find('report') ?? find('sales report'),
      totalMs: this.steps.reduce((sum, s) => sum + s.durationMs, 0),
    };
  }
}
