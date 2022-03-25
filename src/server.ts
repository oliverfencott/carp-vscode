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

const caches = {
  completions: new Map<string, CompletionItem[]>(),
  diagnostics: new Map<string, Diagnostic[]>()
};

const carp = new Carp();

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

// TODO: Pass a symbol path to the completion function, to allow for nested module autocompletion (for faster results)
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
    uri: document.textDocument.uri,
    line: document.position.line + 1,
    column: document.position.character + 1
  });

  clearAndPublishDiagnostics(diagnostics);

  return response;
});

connection.onDocumentSymbol(async params => {
  const { uri } = params.textDocument;
  const { response, diagnostics } = await carp.documentSymbol({ uri });

  clearAndPublishDiagnostics(diagnostics);

  return response;
});

connection.onDefinition(async params => {
  const { response, diagnostics } = await carp.definition({
    uri: params.textDocument.uri,
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
  carp.validate({ uri }).then(res => {
    clearAndPublishDiagnostics(res.diagnostics);
  });
}

function clearAndPublishDiagnostics<T>(
  diagnostics: PublishDiagnosticsParams[]
) {
  caches.diagnostics.forEach((_, uri) => {
    connection.sendDiagnostics({
      uri,
      diagnostics: []
    });
  });

  caches.diagnostics.clear();

  diagnostics.forEach(d => {
    if (caches.diagnostics.has(d.uri)) {
      caches.diagnostics.get(d.uri)!.push(...d.diagnostics);
    } else {
      caches.diagnostics.set(d.uri, d.diagnostics);
    }
  });

  caches.diagnostics.forEach((diagnostics, uri) => {
    connection.sendDiagnostics({ uri, diagnostics });
  });
}
