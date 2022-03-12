import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { Hover } from 'vscode-languageserver-protocol';
import { IS_DEV } from './env';
import { makeRandomString, safeParse, stripColor } from './util';

const PROMPT = '--' + makeRandomString() + '--';

export class Carp {
  private _resolve: Promise<unknown>;
  private _carp: ChildProcessWithoutNullStreams;

  constructor() {
    if (IS_DEV) {
      this._carp = spawn(`stack`, ['run', '--', '--prompt', PROMPT, '-l'], {
        cwd: '../carp'
      });
    } else {
      this._carp = spawn('carp', ['--prompt', PROMPT]);
    }

    this._carp.on('error', e => {
      console.log('Error:', e);
    });

    this._carp.stderr.on('data', d => {
      console.log('Error from Carp:', d.toString());
    });

    this._resolve = new Promise(res => {
      const onData = (data: Buffer | string) => {
        data = stripColor(data.toString());

        if (data.endsWith(PROMPT)) {
          this._carp.stdout.off('data', onData);

          res(void 0);
        }
      };

      this._carp.stdout.on('data', onData);
    });
  }

  private _execute(command: string) {
    return this._resolve.then(() => {
      let text = '';

      const prom = new Promise(res => {
        const onData = (data: Buffer | string) => {
          data = stripColor(data.toString());

          console.log(data);

          if (data.endsWith(PROMPT)) {
            text += data.slice(0, -PROMPT.length);
            this._carp.stdout.off('data', onData);

            res(void 0);
          } else {
            text += data;
          }
        };

        this._carp.stdout.on('data', onData);
        this._carp.stdin.write(command + '\n');
      });

      this._resolve = prom;

      return this._resolve.then(() => text);
    });
  }

  hover({
    filePath,
    line,
    column
  }: {
    filePath: string;
    line: number;
    column: number;
  }) {
    const splitter = makeRandomString();
    return this._execute(
      [
        `(load "${filePath}")`,
        `(macro-log "${splitter}")`,
        `(Analysis.text-document/hover "${filePath}" ${line} ${column})`
      ].join('')
    ).then(res => {
      [, res] = res.split(splitter);
      const response = safeParse<Hover>(res);

      return response;
    });
  }

  check({ filePath }: { filePath: string }) {
    return this._execute([`(load "${filePath}")`].join('')).then(res => {
      console.log(res);

      return res;
    });
  }

  quit() {
    return this._execute('(quit)');
  }
}

export default Carp;
