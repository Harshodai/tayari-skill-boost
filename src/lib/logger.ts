// ponytail: tiny console wrapper, no new dep. Silences debug in prod so
// eslint no-console warnings stay meaningful. Use `logger` instead of `console`.
const isProd = import.meta.env?.PROD ?? false;

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

const make = (fn: LogFn, level: "debug" | "info" | "warn" | "error"): LogFn =>
  isProd && level === "debug" ? noop : (...args: unknown[]) => fn("[tayari]", ...args);

export const logger = {
  debug: make((...a: unknown[]) => console.debug(...a), "debug"),
  info: make((...a: unknown[]) => console.info(...a), "info"),
  warn: make((...a: unknown[]) => console.warn(...a), "warn"),
  error: make((...a: unknown[]) => console.error(...a), "error"),
};

export default logger;