import argon2 from "argon2";
import { Injectable } from "@nestjs/common";

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(passwordHash: string, candidate: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, candidate);
    } catch {
      return false;
    }
  }
}
