import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { ClamAvScannerService } from "./clamav-scanner.service.js";
import { PrivateImageInspectionService } from "./private-image-inspection.service.js";
import { PrivateObjectDeletionService } from "./private-object-deletion.service.js";
import { S3ObjectStorageService } from "./s3-object-storage.service.js";

@Module({
  imports: [PrismaModule],
  providers: [
    S3ObjectStorageService,
    ClamAvScannerService,
    PrivateImageInspectionService,
    PrivateObjectDeletionService,
  ],
  exports: [
    S3ObjectStorageService,
    ClamAvScannerService,
    PrivateImageInspectionService,
    PrivateObjectDeletionService,
  ],
})
export class ObjectStorageModule {}
