import { z } from "zod";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const SYMBOL_REGEX = /^[A-Za-z][A-Za-z0-9._-]{0,15}$/;
const INTERVAL_REGEX = /^[0-9]+(min|h|day|week|month)$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[Tt ].*)?$/;
const LOGIN_REGEX = /^[A-Za-z0-9._-]{3,40}$/;

function firstValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length === 1 ? value[0] : value;
  }
  return value;
}

function toStringValue(value: unknown): string {
  const raw = firstValue(value);
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

function toBoolean(value: unknown, defaultValue: boolean): unknown {
  const raw = firstValue(value);
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return raw;
}

function booleanParam(defaultValue: boolean) {
  return z.preprocess((value) => toBoolean(value, defaultValue), z.boolean());
}

function integerParam(defaultValue: number, min: number, max: number) {
  return z.preprocess((value) => {
    const raw = firstValue(value);
    if (raw === undefined || raw === null || raw === "") return defaultValue;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
  }, z.number().int().min(min).max(max));
}

const symbolValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(SYMBOL_REGEX, "Invalid symbol format")
  .transform((value) => value.toUpperCase());

const symbolParamSchema = z.preprocess(
  (value) => toStringValue(value).trim(),
  symbolValueSchema
);

const optionalSymbolParamSchema = z.preprocess((value) => {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : undefined;
}, symbolValueSchema.optional());

function requiredSymbolsParam(maxItems: number) {
  const base = z.array(symbolValueSchema).min(1).max(maxItems);
  return z.preprocess((value) => {
    const raw = Array.isArray(value) ? value.join(",") : toStringValue(value);
    const symbols = Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    return symbols;
  }, base);
}

function optionalSymbolsParam(maxItems: number) {
  const base = z.array(symbolValueSchema).min(1).max(maxItems);
  return z.preprocess((value) => {
    const raw = Array.isArray(value) ? value.join(",") : toStringValue(value);
    const symbols = Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    if (!symbols.length) return undefined;
    return symbols;
  }, base.optional());
}

const optionalDateParamSchema = z.preprocess((value) => {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : undefined;
}, z.string().regex(DATE_REGEX, "Expected date format YYYY-MM-DD").optional());

const intervalParamSchema = z.preprocess((value) => {
  const normalized = toStringValue(value).trim();
  return normalized || "1day";
}, z.string().regex(INTERVAL_REGEX, "Invalid interval format").transform((value) => value.toLowerCase()));

const optionalTrimmedString = (maxLength = 200) =>
  z.preprocess((value) => {
    const normalized = toStringValue(value).trim();
    return normalized ? normalized : undefined;
  }, z.string().max(maxLength).optional());

const requiredTrimmedString = (maxLength = 200) =>
  z.string().trim().min(1).max(maxLength);

const loginBodyValueSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(LOGIN_REGEX, "Invalid login format")
  .transform((value) => value.toLowerCase());

const loginPasswordValueSchema = z.string().min(8).max(128);

const registerPasswordValueSchema = loginPasswordValueSchema.superRefine(
  (value, ctx) => {
    const strongEnough =
      value.length >= 12 &&
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value);
    if (!strongEnough) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Password must be at least 12 characters and include upper/lowercase letters, a number, and a symbol"
      });
    }
  }
);

export const backtestQuerySchema = z
  .object({
    symbol: symbolParamSchema,
    short: integerParam(20, 2, 250),
    long: integerParam(50, 3, 400)
  })
  .superRefine((value, ctx) => {
    if (value.short >= value.long) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "short must be less than long",
        path: ["short"]
      });
    }
  });

export const compareQuerySchema = z.object({
  symbols: requiredSymbolsParam(4)
});

export const dashboardQuerySchema = z.object({
  symbols: optionalSymbolsParam(120),
  news: booleanParam(true),
  heatmap: booleanParam(true),
  newsSymbol: optionalSymbolParamSchema,
  refresh: booleanParam(false)
});

export const heatmapQuerySchema = z.object({
  refresh: booleanParam(false)
});

export const insiderFlowQuerySchema = z.object({
  symbols: optionalSymbolsParam(10)
});

export const newsQuerySchema = z.object({
  symbol: optionalSymbolParamSchema,
  from: optionalDateParamSchema,
  to: optionalDateParamSchema,
  refresh: booleanParam(false)
});

export const quoteQuerySchema = z.object({
  symbol: symbolParamSchema,
  refresh: booleanParam(false)
});

export const quotesQuerySchema = z.object({
  symbols: requiredSymbolsParam(120),
  refresh: booleanParam(false)
});

export const secQuerySchema = z.object({
  symbol: symbolParamSchema,
  refresh: booleanParam(false)
});

export const stockQuerySchema = z.object({
  symbol: symbolParamSchema,
  interval: intervalParamSchema,
  refresh: booleanParam(false)
});

export const tickersQuerySchema = z.object({
  q: z.preprocess((value) => toStringValue(value).trim().toUpperCase(), z.string().max(32)),
  limit: integerParam(12, 1, 40),
  refresh: booleanParam(false)
});

export const timeMachineQuerySchema = z.object({
  symbols: requiredSymbolsParam(4)
});

export const timeSeriesQuerySchema = z.object({
  symbol: symbolParamSchema,
  interval: intervalParamSchema,
  refresh: booleanParam(false)
});

export const warmupQuerySchema = z.object({
  symbols: optionalSymbolsParam(12),
  refresh: booleanParam(false)
});

export const streamQuotesQuerySchema = z.object({
  symbols: requiredSymbolsParam(24)
});

export const tbankSbpRegistrationBodySchema = z.object({
  extCompanyId: requiredTrimmedString(80),
  extShopId: requiredTrimmedString(80),
  bankName: requiredTrimmedString(120),
  bik: requiredTrimmedString(40),
  corrAccount: requiredTrimmedString(60),
  currentAccount: requiredTrimmedString(60),
  serialNumber: requiredTrimmedString(80),
  apiType: z.preprocess((value) => {
    const normalized = toStringValue(value).trim();
    return normalized || "sbp";
  }, requiredTrimmedString(20)),
  partnerId: optionalTrimmedString(120)
});

export const webVitalsBodySchema = z.object({
  id: requiredTrimmedString(100),
  name: requiredTrimmedString(64),
  value: z.preprocess((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }, z.number().finite()),
  rating: optionalTrimmedString(32),
  navigationType: optionalTrimmedString(64)
});

export const authLoginBodySchema = z.object({
  login: loginBodyValueSchema,
  password: loginPasswordValueSchema
});

export const authRegisterBodySchema = authLoginBodySchema.extend({
  password: registerPasswordValueSchema,
  name: optionalTrimmedString(120)
});

export const emptyQuerySchema = z.object({}).strict();
