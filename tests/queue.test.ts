import { describe, it, expect } from 'vitest';

// Mocking the logic from server.ts for unit testing
const calculateEWT = (serviceType: string, queueLength: number) => {
  const processingTimes: Record<string, number> = {
    concession: 2.5,
    restroom: 1.5,
    entry: 0.5,
    exit: 0.2
  };
  const avgTime = processingTimes[serviceType] || 1.0;
  return queueLength * avgTime;
};

describe('Queue Logic', () => {
  it('should calculate correct EWT for concession', () => {
    expect(calculateEWT('concession', 10)).toBe(25);
  });

  it('should calculate correct EWT for restroom', () => {
    expect(calculateEWT('restroom', 4)).toBe(6);
  });

  it('should return default time for unknown service', () => {
    expect(calculateEWT('unknown', 10)).toBe(10);
  });
});
