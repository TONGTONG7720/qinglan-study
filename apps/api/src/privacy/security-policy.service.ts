import type { CurrentUser, SecurityPolicyInput } from "@study/contracts";
import { decideSecurityPolicy } from "@study/contracts";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";

@Injectable()
export class SecurityPolicyService {
  constructor(private readonly prisma: PrismaService) {}
  async evaluate(actor: CurrentUser, input: SecurityPolicyInput) {
    const decision = decideSecurityPolicy(input);
    await this.prisma.auditEvent.create({ data: { actorUserId: actor.id, familyId: actor.activeFamilyId, action: "SECURITY_DECISION", resourceType: "SecurityPolicy", metadata: { category: input.category, signalCode: input.signalCode, decision } } });
    return { decision };
  }
}
