import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { IS_DEV } from './env';
import path = require('path');

type execOpts = {
  filePath: string;
  splitter: string;
};

const safeParse = <T>(s: string): T | undefined => {
  try {
    return JSON.parse(s) as T;
  } catch (_) {
    return undefined;
  }
};

// prettier-ignore
const DEV_COMMAND = (opts: execOpts) =>
  `stack run -- --eval-postload "` +
    `(do ` +
      `(load \\"${opts.filePath}\\") ` +
      `(macro-log \\"${opts.splitter}\\") ` +
      // `(build-info ['Array] [\\"${opts.filePath}\\"]) ` +
      `(build-info) ` +
      `(quit)` +
    `) \\"${opts.filePath}\\"`+
  `"`;

const PROD_COMMAND = (opts: execOpts) =>
  // `carp --eval-postload '(do (load "filename") (build-info ['Array] []) (quit))'`;
  ``;

type jsonMap = { [key: string]: json };
type jsonList = json[];
type json = string | number | boolean | null | jsonList | jsonMap;

export type Bindings = {
  bindings: CarpBinding[];
  builtIns: {
    [key: string]: CarpBinding;
  };
};

export type CarpBinding = {
  type: null | string;
  info: null | {
    line: number;
    column: number;
    file: string;
  };
  isBuiltIn: boolean;
  symbol: string;
  meta: jsonMap;
};

export type CarpResponse = CarpBinding[];

let _currentState: undefined | Bindings;

export class Carp {
  static getState() {
    return _currentState;
  }

  static exec({ filePath }: { filePath: string }) {
    filePath = filePath.replace('file://', '');

    if (IS_DEV) {
      /** @todo ALL THIS IS_DEV NONSENSE */
      filePath = path.relative(
        '/Users/oliverfencott/Desktop/projects/carp',
        filePath
      );
    }

    const options: execOpts = {
      splitter: randomBytes(20).toString('hex'),
      filePath: filePath
    };

    const { command, cwd }: { command: string; cwd: string } = IS_DEV
      ? { command: DEV_COMMAND(options), cwd: '../carp' }
      : { command: PROD_COMMAND(options), cwd: '.' };

    const stdout = execSync(command, { cwd });
    const [message, output] = stdout.toString().split(options.splitter);

    console.log('message:', message);
    console.log('response:', output);

    const response = safeParse<CarpResponse>(output);
    if (response) {
      _currentState = {
        bindings: response,
        builtIns: Object.fromEntries(
          response.filter(x => x.isBuiltIn).map(x => [x.symbol, x])
        )
      };
    }

    return Carp.getState();
  }
}

export default Carp;
