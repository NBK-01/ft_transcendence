export interface ProgressiveTier {
  period: number; // seconds
  maxRequests: number;
  blockDuration: number; // seconds
}

export interface ProgressivePolicy {
  tiers: ProgressiveTier[];
}

export interface RequestRecord {
  identifier: string;
  prefix: string;
  requests: number[]; // unix timestamps
  violations: ViolationRecord[];
  lastCleanup?: number;
}

export interface ViolationRecord {
  tier: number; // 1-based
  timestamp: number;
  blockUntil: number;
  period: number;
  maxRequests: number;
}
