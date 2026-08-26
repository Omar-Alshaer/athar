import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await this.derive(password, salt);
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString('hex')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, nRaw, rRaw, pRaw, salt, expectedHex] = parts;
    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);

    if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;

    const expected = Buffer.from(expectedHex, 'hex');
    if (expected.length !== KEY_LENGTH) return false;

    const actual = await this.derive(password, salt);
    return timingSafeEqual(actual, expected);
  }

  private derive(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(derivedKey);
        },
      );
    });
  }
}
