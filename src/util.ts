import { randomBytes } from 'crypto';

export const safeParse = <T>(s: string): T | undefined => {
  try {
    return JSON.parse(s) as T;
  } catch (_) {
    return undefined;
  }
};

export const stripColor = (str: string) =>
  str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');

export const makeRandomString = () => randomBytes(20).toString('hex');
