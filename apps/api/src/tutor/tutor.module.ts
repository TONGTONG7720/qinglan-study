import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { CurriculumRetriever } from "./curriculum-retriever.service.js";
import { TutorController } from "./tutor.controller.js";
import { TutorService } from "./tutor.service.js";
@Module({ imports: [PrismaModule, AuthModule, AiModule], controllers: [TutorController], providers: [CurriculumRetriever, TutorService] })
export class TutorModule {}
