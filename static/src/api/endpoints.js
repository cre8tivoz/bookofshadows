function query(params) {
  return new URLSearchParams(params).toString();
}

export const endpoints = {
  stats: () => "/api/stats",
  config: () => "/api/config",
  diagnostics: () => "/api/diagnostics",
  lifecycle: (limit = 80) => `/api/lifecycle?${query({ limit: String(limit) })}`,
  runtimeStatus: () => "/api/runtime/status",
  realtimeStatus: () => "/api/realtime/status",
  patterns: (limit = 10) => `/api/patterns?${query({ limit: String(limit) })}`,
  profile: (limit = 10) => `/api/profile/inferred?${query({ limit: String(limit) })}`,
  search: (q = "", limit = 30) => `/api/search?${query({ q, limit: String(limit) })}`,
  memories: (params = {}) => `/api/memories?${new URLSearchParams(params).toString()}`,
  graph: (q = "", limit = 300) => `/api/graph?${query({ q, limit: String(limit) })}`,
  review: (params = {}) => `/api/review?${new URLSearchParams(params).toString()}`,
  memoryGrowth: (days = 30) => `/api/insights/memory-growth?${query({ days: String(days) })}`,
  auditActivity: (days = 30) => `/api/insights/audit-activity?${query({ days: String(days) })}`,
  recallDistribution: () => "/api/insights/recall-distribution",
  veracityMix: (days = 30) => `/api/insights/veracity-mix?${query({ days: String(days) })}`,
  sourceBreakdown: (days = 30, limit = 6) => `/api/insights/source-breakdown?${query({ days: String(days), limit: String(limit) })}`,
  reviewBacklog: (days = 30) => `/api/insights/review-backlog?${query({ days: String(days) })}`,
  lifecycleTransitions: (days = 30) => `/api/insights/lifecycle-transitions?${query({ days: String(days) })}`,
  entityClusters: (limit = 10) => `/api/insights/entity-clusters?${query({ limit: String(limit) })}`,
  sessionHeatmap: (days = 30) => `/api/insights/session-heatmap?${query({ days: String(days) })}`,
  actionCards: () => "/api/insights/action-cards",
};

export const lowVolatilityTtlMs = {
  "/api/auth/status": 3_000,
  "/api/stats": 3_000,
  "/api/config": 5_000,
  "/api/diagnostics": 5_000,
  "/api/consolidations": 5_000,
  "/api/lifecycle": 5_000,
  "/api/runtime/status": 5_000,
  "/api/realtime/status": 3_000,
  "/api/patterns": 5_000,
  "/api/profile/inferred": 5_000,
  "/api/constellation": 5_000,
  "/api/memoria/stats": 5_000,
};
