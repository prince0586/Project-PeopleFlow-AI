import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../server/services/analyticsService';

describe('AnalyticsService', () => {
  it('should generate a report with filtered throughput', async () => {
    const venueId = 'stadium_01';
    const reportAll = await AnalyticsService.getVenueReport(venueId);
    const reportFiltered = await AnalyticsService.getVenueReport(venueId, 'ROUTE_CALCULATION');

    expect(reportAll.totalThroughput).toBe(15420);
    expect(reportFiltered.totalThroughput).toBeLessThan(15420);
    expect(reportFiltered.eventType).toBe('ROUTE_CALCULATION');
  });
});
