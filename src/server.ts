import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItemKind,
  CompletionTriggerKind,
  createConnection,
  InitializeResult,
  ProposedFeatures,
  PublishDiagnosticsParams,
  SymbolInformation,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import Carp from './carp';
import { safeParse } from './util';

function stripFileProtocol(path: string) {
  return path.replace('file://', '');
}

function addFileProtocol(path: string) {
  return 'file://' + path;
}

const carp = new Carp();
const diagnosticsCache = new Set<string>();
const documentSymbolsCache = new Set<string>();

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize(_params => {
  const result: InitializeResult = {
    capabilities: {
      hoverProvider: true,
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
      definitionProvider: true,
      completionProvider: {
        triggerCharacters: ['.']
      }
      // Tell the client that this server supports code completion.
      // completionProvider: {
      //   resolveProvider: true
      // }
    }
  };

  return result;
});

connection.onExit(() => carp.quit());

connection.onCompletion(params => {
  console.log(JSON.stringify(params, null, 2));

  if (params.context?.triggerKind == CompletionTriggerKind.TriggerCharacter) {
    if (params.context.triggerCharacter == '.') {
      // TODO: Get a list of all available modules and autocomplete them
    }
  }

  const types: [string, CompletionItemKind][] = [
    ['Text', 1],
    ['Method', 2],
    ['Function', 3],
    ['Constructor', 4],
    ['Field', 5],
    ['Variable', 6],
    ['Class', 7],
    ['Interface', 8],
    ['Module', 9],
    ['Property', 10],
    ['Unit', 11],
    ['Value', 12],
    ['Enum', 13],
    ['Keyword', 14],
    ['Snippet', 15],
    ['Color', 16],
    ['File', 17],
    ['Reference', 18],
    ['Folder', 19],
    ['EnumMember', 20],
    ['Constant', 21],
    ['Struct', 22],
    ['Event', 23],
    ['Operator', 24],
    ['TypeParameter', 25]
  ];

  return types.map(([label, kind]) => {
    return {
      label: label + ' example',
      detail: label.toLowerCase() + '-thing',
      documentation: `The docs for ${label}`,
      kind
    };
  });
});

/** Validate file on open */
connection.onDidOpenTextDocument(params => {
  checkFile(params.textDocument.uri);
});

/** Validate file on save */
documents.onDidSave(params => {
  checkFile(params.document.uri);
});

connection.onHover(async (document, _token, _progressReporter) => {
  return carp.hover({
    filePath: stripFileProtocol(document.textDocument.uri),
    line: document.position.line + 1,
    column: document.position.character + 1
  });
});

connection.onDocumentSymbol(async params => {
  const uri = stripFileProtocol(params.textDocument.uri);

  const res = await carp.textDocumentDocumentSymbol({
    filePath: uri
  });

  if (!res) {
    return;
  }

  const messages = res.split('\n');

  if (messages.length == 0) {
    return null;
  }

  const symbols = messages
    .map(x => safeParse<SymbolInformation | null>(x))
    .flatMap(res => {
      switch (res) {
        case undefined:
        case null:
          return [];

        default:
          return [res];
      }
    });

  documentSymbolsCache.clear();
  symbols.map(s => s.location.uri).forEach(u => documentSymbolsCache.add(u));

  return symbols;
});

connection.onDefinition(async params => {
  const response = await carp.textDocumentDefinition({
    filePath: stripFileProtocol(params.textDocument.uri),
    line: params.position.line + 1,
    column: params.position.character + 1
  });

  if (response) {
    return response;
  }

  return null;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function checkFile(uri: string) {
  diagnosticsCache.forEach(uri => {
    connection.sendDiagnostics({
      uri,
      diagnostics: []
    });
  });

  diagnosticsCache.clear();

  carp.check({ filePath: stripFileProtocol(uri) }).then(res => {
    console.log('on did save request response:');
    console.log(res);
    const responses = res
      .split('\n')
      .map(x => safeParse<PublishDiagnosticsParams>(x))
      .filter(Boolean) as PublishDiagnosticsParams[];

    if (!responses.length) {
      return [];
    }

    responses.forEach(response => {
      diagnosticsCache.add(response.uri);
    });

    responses.forEach(connection.sendDiagnostics);
  });
}
