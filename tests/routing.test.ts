import { describe, it, expect } from 'vitest';

const calculateRouteScore = (distance: number, congestion: number) => {
  return distance * (1 + congestion);
};

describe('Routing Algorithm', () => {
  it('should favor lower congestion for same distance', () => {
    const score1 = calculateRouteScore(100, 0.1);
    const score2 = calculateRouteScore(100, 0.8);
    expect(score1).toBeLessThan(score2);
  });

  it('should favor shorter distance for same congestion', () => {
    const score1 = calculateRouteScore(50, 0.5);
    const score2 = calculateRouteScore(100, 0.5);
    expect(score1).toBeLessThan(score2);
  });

  it('should correctly balance distance and congestion', () => {
    // Distance 100, Congestion 0.1 => 110
    // Distance 80, Congestion 0.5 => 120
    const score1 = calculateRouteScore(100, 0.1);
    const score2 = calculateRouteScore(80, 0.5);
    expect(score1).toBeLessThan(score2);
  });
});
