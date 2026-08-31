import { Injectable } from "@nestjs/common";
import type { LoggerService } from "@nestjs/common";

const secretKeyPattern = /(authorization|cookie|password|secret|token|api[-_]?key|object[-_]?key)/iu;

export function redactValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        secretKeyPattern.test(key) ? "[REDACTED]" : redactValue(entry),
      ]),
    );
  }

  return value;
}

@Injectable()
export class RedactingLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("info", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("verbose", message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const entry = JSON.stringify({
      level,
      timestamp: new Date().toISOString(),
      message: redactValue(message),
      details: redactValue(optionalParams),
    });
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(`${entry}\n`);
  }
}
