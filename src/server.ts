import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  Diagnostic,
  InitializeResult,
  ProposedFeatures,
  PublishDiagnosticsParams,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import Carp from './carp';

function stripFileProtocol(path: string) {
  return path.replace('file://', '');
}

function addFileProtocol(path: string) {
  return 'file://' + path;
}

const caches = {
  completions: new Map<string, CompletionItem[]>()
};

const carp = new Carp();
const diagnosticsCache = new Map<string, Diagnostic[]>();

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

connection.onCompletion(async params => {
  // const { uri } = params.textDocument;

  // if (caches.completions.has(uri)) {
  //   return caches.completions.get(uri);
  // }

  // if (params.context?.triggerKind == CompletionTriggerKind.TriggerCharacter) {
  //   if (params.context.triggerCharacter == '.') {
  //     // TODO: Get a list of all available modules and autocomplete them
  //   }
  // }

  // const filePath = stripFileProtocol(uri);
  // const response = await carp.textDocumentCompletion({ filePath });

  // if (response) {
  //   caches.completions.set(uri, response);
  //   return response;
  // }

  return null;

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
      label: label + ' label',
      detail: label.toLowerCase() + '-detail',
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
  console.log('Did just save');
  caches.completions.delete(params.document.uri);

  checkFile(params.document.uri);
});

connection.onHover(async (document, _token, _progressReporter) => {
  const { response, diagnostics } = await carp.hover({
    filePath: stripFileProtocol(document.textDocument.uri),
    line: document.position.line + 1,
    column: document.position.character + 1
  });

  clearAndPublishDiagnostics(diagnostics);

  return response;
});

connection.onDocumentSymbol(async params => {
  const uri = stripFileProtocol(params.textDocument.uri);

  const { response, diagnostics } = await carp.documentSymbol({
    filePath: uri
  });

  clearAndPublishDiagnostics(diagnostics);

  return response;
});

connection.onDefinition(async params => {
  const { response, diagnostics } = await carp.definition({
    filePath: stripFileProtocol(params.textDocument.uri),
    line: params.position.line + 1,
    column: params.position.character + 1
  });

  clearAndPublishDiagnostics(diagnostics);

  return response;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function checkFile(uri: string) {
  diagnosticsCache.forEach((_, uri) => {
    connection.sendDiagnostics({
      uri,
      diagnostics: []
    });
  });

  diagnosticsCache.clear();

  carp.validate({ filePath: stripFileProtocol(uri) }).then(res => {
    console.log('on did save request response:');
    console.log(res);
    // const responses = res
    //   .split('\n')
    //   .map(x => safeParse<PublishDiagnosticsParams>(x))
    //   .filter(Boolean) as PublishDiagnosticsParams[];

    // if (!responses.length) {
    //   return [];
    // }

    // responses.forEach(response => {
    //   diagnosticsCache.add(response.uri);
    // });

    // connection.sendDiagnostics({
    //   uri: '',
    //   diagnostics: [
    //     {
    //       message: 'msg',
    //       range: {
    //         start: { character: 0, line: 0 },
    //         end: { character: 0, line: 0 }
    //       },
    //       severity: 1
    //     }
    //   ]
    // });

    // responses.forEach(connection.sendDiagnostics);
  });
}

function clearAndPublishDiagnostics<T>(
  diagnostics: PublishDiagnosticsParams[]
) {
  diagnosticsCache.forEach((_, uri) => {
    connection.sendDiagnostics({
      uri,
      diagnostics: []
    });
  });

  diagnosticsCache.clear();

  diagnostics.forEach(d => {
    if (diagnosticsCache.has(d.uri)) {
      diagnosticsCache.get(d.uri)!.push(...d.diagnostics);
    } else {
      diagnosticsCache.set(d.uri, d.diagnostics);
    }
  });

  diagnosticsCache.forEach((diagnostics, uri) => {
    connection.sendDiagnostics({ uri, diagnostics });
  });
}
