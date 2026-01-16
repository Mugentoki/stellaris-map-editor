// Map coordinate limits for Stellaris static galaxy scenarios
export const MAP_LIMITS = {
  // X and Y coordinates can range from -500 to +500
  XY_MIN: -500,
  XY_MAX: 500,
  
  // Z coordinates can only range from -5 to +5
  Z_MIN: -5,
  Z_MAX: 5
} as const;

export type MapLimits = typeof MAP_LIMITS;
