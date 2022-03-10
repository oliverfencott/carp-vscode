import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { Hover } from 'vscode-languageserver-protocol';
import { IS_DEV } from './env';
import path = require('path');

type execOpts = {
  filePath: string;
  splitter: string;
  command: string;
};

const safeParse = <T>(s: string): T | undefined => {
  try {
    return JSON.parse(s) as T;
  } catch (_) {
    return undefined;
  }
};

const DEV_COMMAND = (opts: execOpts) => {
  const path = `\\"${opts.filePath}\\"`;
  const splitter = `\\"${opts.splitter}\\"`;
  const postloadCode = `(do (load ${path}) (macro-log ${splitter}) ${opts.command} (quit)) ${path}`;
  /**
    鲤 (load "/Users/oliverfencott/Desktop/projects/carp/__dev__/test.carp")
    鲤 (analysis/definition "/Users/oliverfencott/Desktop/projects/carp/__dev__/test.carp" 7 15)
   */

  const command = `stack run -- --eval-postload "${postloadCode}"`;

  console.log(command);
  return command;
};

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

// let _hoverOutput: Hover|undefined

export class Carp {
  static getState() {
    return _currentState;
  }

  private static parsePath(filePath: string) {
    filePath = filePath.replace('file://', '');

    if (IS_DEV) {
      /** @todo ALL THIS IS_DEV NONSENSE */
      // filePath = path.relative(
      //   '/Users/oliverfencott/Desktop/projects/carp',
      //   filePath
      // );
    }

    return filePath;
  }

  static hover({
    filePath,
    line,
    character
  }: {
    filePath: string;
    line: number;
    character: number;
  }): Hover {
    filePath = Carp.parsePath(filePath);

    const options: execOpts = {
      splitter: randomBytes(20).toString('hex'),
      command: `(Analysis.text-document/hover \\"${filePath}\\" ${
        line + 1
      } ${character})`,
      filePath: filePath
    };

    const { command, cwd }: { command: string; cwd: string } = IS_DEV
      ? { command: DEV_COMMAND(options), cwd: '../carp' }
      : { command: PROD_COMMAND(options), cwd: '.' };

    const stdout = execSync(command, { cwd });
    const [message, output] = stdout.toString().split(options.splitter);

    console.log('message:', message);
    console.log('response:', output);

    const response = safeParse<Hover>(output);

    // return {
    //   contents: {
    //     kind: 'markdown',
    //     value: 'hello, hovered'
    //   }
    // };

    return response!;
  }

  static exec({ filePath }: { filePath: string }) {
    filePath = Carp.parsePath(filePath);

    const options: execOpts = {
      splitter: randomBytes(20).toString('hex'),
      command: '(build-info)',
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

/*

stack run -- --eval-postload "
  (do
    (load \"../carp-vscode/examples/test.carp\")
    (macro-log \"da6b26447eb1d7877003d373da84443ad144c083\")
    (load "../carp-vscode/examples/test.carp")
    (analysis/definition "../carp-vscode/examples/test.carp" 10 12)
    (quit)
  )
  \"../carp-vscode/examples/test.carp\"
  "

*/

/*

stack run -- --eval-postload "
  (do
    (load \"../carp-vscode/examples/test.carp\")
    (macro-log \"c723bedd30865a4a2f813c69af95819c187ea3d0\")
    (build-info)
    (quit)
  )
  \"../carp-vscode/examples/test.carp\"
  "

*/
