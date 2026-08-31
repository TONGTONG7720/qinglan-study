import type { HealthResponse } from "@study/contracts";
import { Controller, Get } from "@nestjs/common";

@Controller("v1/health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok", service: "api", version: "0.1.0" };
  }
}
