import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { ClamAvScannerService, MalwareScanResult } from "./clamav-scanner.service.js";
import { PrivateImageInspectionService } from "./private-image-inspection.service.js";

function scanner(result: MalwareScanResult | Error): ClamAvScannerService {
  return {
    scan: () => result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  } as unknown as ClamAvScannerService;
}

describe("PrivateImageInspectionService", () => {
  it("accepts only a fully decoded image matching every declaration", async () => {
    const bytes = await image();
    const result = await new PrivateImageInspectionService(scanner({ status: "CLEAN" })).inspect(bytes, {
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      width: 64,
      height: 48,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(result).toEqual({ accepted: true });
  });

  it.each([
    ["size", { sizeBytes: 1 }, "SIZE_MISMATCH"],
    ["sha", { sha256: "0".repeat(64) }, "SHA256_MISMATCH"],
    ["mime signature", { mimeType: "image/jpeg" }, "FILE_SIGNATURE_MISMATCH"],
    ["dimensions", { width: 65 }, "IMAGE_METADATA_MISMATCH"],
  ] as const)("rejects a %s mismatch", async (_name, override, errorCode) => {
    const bytes = await image();
    const declaration = {
      mimeType: "image/png" as const,
      sizeBytes: bytes.byteLength,
      width: 64,
      height: 48,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...override,
    };
    const result = await new PrivateImageInspectionService(scanner({ status: "CLEAN" })).inspect(
      bytes,
      declaration,
    );
    expect(result).toEqual({ accepted: false, errorCode, scanStatus: "FAILED" });
  });

  it("fails closed for an unavailable scanner and quarantines detected malware", async () => {
    const bytes = await image();
    const declaration = {
      mimeType: "image/png" as const,
      sizeBytes: bytes.byteLength,
      width: 64,
      height: 48,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    await expect(new PrivateImageInspectionService(scanner(new Error("offline"))).inspect(bytes, declaration))
      .resolves.toEqual({ accepted: false, errorCode: "MALWARE_SCAN_FAILED", scanStatus: "FAILED" });
    await expect(new PrivateImageInspectionService(scanner({ status: "INFECTED", signature: "test" })).inspect(bytes, declaration))
      .resolves.toEqual({ accepted: false, errorCode: "MALWARE_DETECTED", scanStatus: "INFECTED" });
  });

  function image() {
    return sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 20, g: 40, b: 60 } },
    }).png().toBuffer();
  }
});
