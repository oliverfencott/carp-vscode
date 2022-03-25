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

export const lines = {
  parse(input: string) {
    const NEWLINE_CHAR = 10;
    let index = 0;
    let text = '';
    const messages: string[] = [];

    while (true) {
      if (index === input.length) {
        messages.push(text);

        break;
      }

      const char = input.charCodeAt(index);

      if (char === NEWLINE_CHAR) {
        messages.push(text);
        text = '';
      } else {
        text += input[index];
      }

      index += 1;
    }

    return messages.filter(Boolean);
  }
};
