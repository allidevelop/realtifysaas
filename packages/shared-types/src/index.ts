/**
 * @realtify/shared-types — контракты API между web (TS) и engine (Pydantic).
 * ТЗ §12: изменение контракта — синхронно здесь и в Pydantic-схемах engine
 * + запись в DECISIONS.md.
 *
 * Этап 0: заготовка. Полные DTO наполняются на соответствующих этапах
 * (гео — §9/этап 2, оценка — §10/этап 4, биллинг — §11/этап 5).
 */

export type Currency = "UAH" | "USD" | "EUR";

/** Сегмент/тип операции рынка (ТЗ §9, листинги). */
export type Operation = "sale" | "rent";
export type Segment = "apartment" | "house" | "commercial" | "land";

// ── Оценка (ТЗ §10.2) ──────────────────────────────────────────
/** POST /api/valuation/express → результат экспресс-оценки. */
export interface ExpressValuationResult {
  value: number;
  currency: Currency;
  /** Метрика доверия 0..1 (ТЗ §10.1 — прозрачность для банков). */
  confidence: number;
  comparablesCount: number;
}

// ── Геоданные (ТЗ §9) ──────────────────────────────────────────
/** Ответ GET /api/geo/metrics — агрегат по территориальной единице. */
export interface GeoMetric {
  adminUnitCode: string;
  period: string; // YYYY-MM
  segment: Segment;
  operation: Operation;
  metricType: string;
  value: number;
  currency: Currency;
}

// ── Служебное ──────────────────────────────────────────────────
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
}

export const SHARED_TYPES_VERSION = "0.0.0" as const;

// Контракты биллинга (ТЗ §11, §12).
export * from "./billing";

// Контракты оценки (ТЗ §10, §12).
export * from "./valuation";
