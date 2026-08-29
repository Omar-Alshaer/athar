import {
  CountryCode,
  getCountries,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';
import { BadRequestException } from '@nestjs/common';

const supportedCountries = new Set<string>(getCountries());

export type NormalizedPhone = {
  phone: string;
  phoneCountry: CountryCode;
};

export function normalizeInternationalPhone(
  rawPhone: string,
  rawCountry: string,
): NormalizedPhone {
  const phone = String(rawPhone ?? '').trim();
  const country = String(rawCountry ?? '').trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(country) || !supportedCountries.has(country)) {
    throw new BadRequestException('اختر دولة صحيحة لرقم الهاتف.');
  }

  if (!phone || phone.length > 32 || /[^+\d()\-.\s]/u.test(phone)) {
    throw new BadRequestException('أدخل رقم هاتف صحيحًا.');
  }

  const parsed = parsePhoneNumberFromString(phone, country as CountryCode);

  if (!parsed || !parsed.isValid() || parsed.country !== country) {
    throw new BadRequestException('رقم الهاتف غير صالح للدولة المحددة.');
  }

  return {
    phone: parsed.number,
    phoneCountry: parsed.country,
  };
}
