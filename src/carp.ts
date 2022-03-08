import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { IS_DEV } from './env';
import path = require('path');

type execOpts = {
  filePath: string;
  splitter: string;
};

const safeParse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch (_) {
    return {};
  }
};

// prettier-ignore
const DEV_COMMAND = (opts: execOpts) =>
  `stack run -- --eval-postload "` +
    `(do ` +
      `(load \\"${opts.filePath}\\") ` +
      `(macro-log \\"${opts.splitter}\\") ` +
      `(build-info ['Array] []) ` +
      `(quit)` +
    `) \\"${opts.filePath}\\"`+
  `"`;

const PROD_COMMAND = (opts: execOpts) =>
  // `carp --eval-postload '(do (load "filename") (build-info ['Array] []) (quit))'`;
  ``;

export class Carp {
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
    const [_, output] = stdout.toString().split(options.splitter);

    return safeParse(output);
  }
}

export default Carp;
