import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import {
  CompletionItem,
  Definition,
  Hover,
  PublishDiagnosticsParams,
  SymbolInformation
} from 'vscode-languageserver-protocol';
import { IS_DEV } from './env';
import { lines, makeRandomString, safeParse, stripColor } from './util';

const PROMPT = '--' + makeRandomString() + '--';

export type Response<T> = {
  diagnostics: PublishDiagnosticsParams[];
  response: T | null;
};

type AsyncResponse<T> = Promise<Response<T>>;

type HoverParams = {
  filePath: string;
  line: number;
  column: number;
};

type DefinitionParams = HoverParams;

export class Carp {
  private _resolve: Promise<string>;
  private _carp: ChildProcessWithoutNullStreams;

  constructor() {
    if (IS_DEV) {
      this._carp = spawn(`stack`, ['run', '--', '--prompt', PROMPT, '-a'], {
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

          res('');
        }
      };

      this._carp.stdout.on('data', onData);
    });
  }

  private _execute(command: string) {
    this._resolve = this._resolve.then(() => {
      let text = '';

      return new Promise(res => {
        const onData = (data: Buffer | string) => {
          data = stripColor(data.toString());

          if (data.endsWith(PROMPT)) {
            text += data.slice(0, -PROMPT.length);
            this._carp.stdout.off('data', onData);

            res(text);
          } else {
            text += data;
          }
        };

        this._carp.stdout.on('data', onData);
        this._carp.stdin.write(command + '\n');
      });
    });

    return this._resolve;
  }

  async hover({ filePath, line, column }: HoverParams): AsyncResponse<Hover> {
    const res = await this._execute(
      `(Analysis.text-document/hover "${filePath}" ${line} ${column})`
    );

    return Carp._parse(res);
  }

  async validate({
    filePath
  }: {
    filePath: string;
  }): AsyncResponse<PublishDiagnosticsParams[]> {
    const res = await this._execute(`(Analysis.validate "${filePath}")`);

    console.log(res);

    return Carp._parse(res);
  }

  async documentSymbol({
    filePath
  }: {
    filePath: string;
  }): AsyncResponse<SymbolInformation[]> {
    const res = await this._execute(
      `(Analysis.text-document/document-symbol "${filePath}")`
    );

    return Carp._parse(res);
  }

  async definition({
    filePath,
    line,
    column
  }: DefinitionParams): AsyncResponse<Definition> {
    const res = await this._execute(
      `(Analysis.text-document/definition "${filePath}" ${line} ${column})`
    );

    return Carp._parse(res);
  }

  async textDocumentCompletion({
    filePath
  }: {
    filePath: string;
  }): AsyncResponse<CompletionItem[]> {
    const res = await this._execute(
      `(Analysis.text-document/completion "${filePath}")`
    );

    return Carp._parse(res);
  }

  quit() {
    return this._execute('(quit)');
  }

  private static _parse<T>(text: string): Response<T> {
    const parsed = lines.parse(text).map(safeParse).filter(Boolean).reverse();
    const [head, ...diagnostics] = parsed;

    if (
      head &&
      // @ts-ignore
      Array.isArray(head.diagnostics)
    ) {
      return {
        response: null,
        diagnostics: parsed as PublishDiagnosticsParams[]
      };
    }

    return {
      response: head as T,
      diagnostics: diagnostics as PublishDiagnosticsParams[]
    };
  }
}

export default Carp;
