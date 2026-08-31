import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { createConnection } from "node:net";
import { z } from "zod";

const ScannerConfigSchema = z.object({
  host: z.string().trim().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65_535),
  timeoutMs: z.coerce.number().int().min(1_000).max(60_000),
}).strict();

type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

export type MalwareScanResult =
  | { status: "CLEAN" }
  | { status: "INFECTED"; signature: string };

@Injectable()
export class ClamAvScannerService {
  isEnabled(): boolean {
    return process.env.OBJECT_SCAN_PROVIDER === "clamav";
  }

  async scan(bytes: Uint8Array): Promise<MalwareScanResult> {
    const response = await this.request((write) => {
      write(Buffer.from("zINSTREAM\0", "utf8"));
      const chunkSize = 64 * 1_024;
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength, 0);
        write(length);
        write(chunk);
      }
      write(Buffer.alloc(4));
    });
    const normalized = response.replace(/\0$/u, "").trim();
    if (normalized.endsWith(" OK")) return { status: "CLEAN" };
    const infected = /^stream: (.+) FOUND$/u.exec(normalized);
    if (infected?.[1] !== undefined) return { status: "INFECTED", signature: infected[1] };
    throw new Error("CLAMAV_UNEXPECTED_RESPONSE");
  }

  async probe(): Promise<void> {
    const response = await this.request((write) => { write(Buffer.from("zPING\0", "utf8")); });
    if (response.replace(/\0$/u, "").trim() !== "PONG") {
      throw new Error("CLAMAV_NOT_READY");
    }
  }

  private configuration(): ScannerConfig {
    if (!this.isEnabled()) throw new ServiceUnavailableException();
    return ScannerConfigSchema.parse({
      host: process.env.CLAMAV_HOST,
      port: process.env.CLAMAV_PORT ?? "3310",
      timeoutMs: process.env.CLAMAV_TIMEOUT_MS ?? "30000",
    });
  }

  private request(send: (write: (chunk: Uint8Array) => void) => void): Promise<string> {
    const config = this.configuration();
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: config.host, port: config.port });
      const responseChunks: Buffer[] = [];
      let responseBytes = 0;
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };
      socket.setTimeout(config.timeoutMs, () => { fail(new Error("CLAMAV_TIMEOUT")); });
      socket.once("error", (error) => { fail(error); });
      socket.on("data", (chunk: Buffer) => {
        responseBytes += chunk.byteLength;
        if (responseBytes > 4_096) {
          fail(new Error("CLAMAV_RESPONSE_TOO_LARGE"));
          return;
        }
        responseChunks.push(chunk);
        if (!chunk.includes(0)) return;
        if (settled) return;
        settled = true;
        socket.end();
        resolve(Buffer.concat(responseChunks).toString("utf8"));
      });
      socket.once("connect", () => {
        try {
          send((chunk) => socket.write(chunk));
        } catch (error) {
          fail(error instanceof Error ? error : new Error("CLAMAV_WRITE_FAILED"));
        }
      });
      socket.once("end", () => {
        if (!settled) fail(new Error("CLAMAV_RESPONSE_INCOMPLETE"));
      });
    });
  }
}
