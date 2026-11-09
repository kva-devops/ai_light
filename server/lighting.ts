export interface LightingCalculationInput {
  area: number;
  targetLux: number;
  fixtureLumens?: number;
}

export interface LightingCalculationResult {
  area: number;
  targetLux: number;
  utilizationFactor: 0.6;
  requiredLumens: number;
  fixtureLumens?: number;
  fixtureCount?: number;
  formula: string;
  assumption: string;
}

export function calculateLighting(input: LightingCalculationInput): LightingCalculationResult {
  const { area, targetLux, fixtureLumens } = input;
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(targetLux) || targetLux <= 0) {
    throw new Error('Площадь и освещённость должны быть положительными числами.');
  }
  if (fixtureLumens !== undefined && (!Number.isFinite(fixtureLumens) || fixtureLumens <= 0)) {
    throw new Error('Световой поток светильника должен быть положительным числом.');
  }

  const requiredLumens = Math.round((area * targetLux) / 0.6);
  return {
    area,
    targetLux,
    utilizationFactor: 0.6,
    requiredLumens,
    ...(fixtureLumens === undefined
      ? {}
      : { fixtureLumens, fixtureCount: Math.ceil(requiredLumens / fixtureLumens) }),
    formula: `${area} м² × ${targetLux} лк / 0,6 = ${requiredLumens} лм`,
    assumption: 'Коэффициент 0,6 — упрощённое допущение для ориентировочной оценки, а не норма.'
  };
}
