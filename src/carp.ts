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
  uri: string;
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
    console.log('[Request]', command);
    this._resolve = this._resolve.then(() => {
      let text = '';

      return new Promise(res => {
        const onData = (data: Buffer | string) => {
          data = stripColor(data.toString());

          if (data.endsWith(PROMPT)) {
            text += data.slice(0, -PROMPT.length);
            this._carp.stdout.off('data', onData);

            console.log('[Response]', text);
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

  async hover({ uri, line, column }: HoverParams): AsyncResponse<Hover> {
    const res = await this._execute(
      `(Analysis.text-document/hover "${uri}" ${line} ${column})`
    );

    return Carp._parse(res);
  }

  async validate({
    uri
  }: {
    uri: string;
  }): AsyncResponse<PublishDiagnosticsParams[]> {
    const res = await this._execute(`(Analysis.validate "${uri}")`);

    return Carp._parse(res);
  }

  async documentSymbol({
    uri
  }: {
    uri: string;
  }): AsyncResponse<SymbolInformation[]> {
    const res = await this._execute(
      `(Analysis.text-document/document-symbol "${uri}")`
    );

    return Carp._parse(res);
  }

  async definition({
    uri,
    line,
    column
  }: DefinitionParams): AsyncResponse<Definition> {
    const res = await this._execute(
      `(Analysis.text-document/definition "${uri}" ${line} ${column})`
    );

    return Carp._parse(res);
  }

  async textDocumentCompletion({
    uri
  }: {
    uri: string;
  }): AsyncResponse<CompletionItem[]> {
    const res = await this._execute(
      `(Analysis.text-document/completion "${uri}")`
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
