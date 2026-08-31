import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import sharp from "sharp";

import { ClamAvScannerService } from "./clamav-scanner.service.js";

interface ImageDeclaration {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
}

export type ImageInspectionResult =
  | { accepted: true }
  | { accepted: false; errorCode: string; scanStatus: "INFECTED" | "FAILED" };

function hasExpectedSignature(bytes: Uint8Array, mimeType: ImageDeclaration["mimeType"]): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return bytes.byteLength >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
}

@Injectable()
export class PrivateImageInspectionService {
  constructor(private readonly scanner: ClamAvScannerService) {}

  async inspect(bytes: Uint8Array, declaration: ImageDeclaration): Promise<ImageInspectionResult> {
    if (bytes.byteLength !== declaration.sizeBytes) {
      return { accepted: false, errorCode: "SIZE_MISMATCH", scanStatus: "FAILED" };
    }
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== declaration.sha256) {
      return { accepted: false, errorCode: "SHA256_MISMATCH", scanStatus: "FAILED" };
    }
    let scan: Awaited<ReturnType<ClamAvScannerService["scan"]>>;
    try {
      scan = await this.scanner.scan(bytes);
    } catch {
      return { accepted: false, errorCode: "MALWARE_SCAN_FAILED", scanStatus: "FAILED" };
    }
    if (scan.status === "INFECTED") {
      return { accepted: false, errorCode: "MALWARE_DETECTED", scanStatus: "INFECTED" };
    }
    if (!hasExpectedSignature(bytes, declaration.mimeType)) {
      return { accepted: false, errorCode: "FILE_SIGNATURE_MISMATCH", scanStatus: "FAILED" };
    }

    try {
      const image = sharp(bytes, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
        sequentialRead: true,
      });
      const metadata = await image.metadata();
      const expectedFormat = declaration.mimeType === "image/jpeg"
        ? "jpeg"
        : declaration.mimeType === "image/png" ? "png" : "webp";
      if (
        metadata.format !== expectedFormat
        || metadata.width !== declaration.width
        || metadata.height !== declaration.height
        || (metadata.pages ?? 1) !== 1
      ) {
        return { accepted: false, errorCode: "IMAGE_METADATA_MISMATCH", scanStatus: "FAILED" };
      }
      await image.stats();
    } catch {
      return { accepted: false, errorCode: "IMAGE_DECODE_FAILED", scanStatus: "FAILED" };
    }
    return { accepted: true };
  }
}
