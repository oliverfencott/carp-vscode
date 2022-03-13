import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  createConnection,
  InitializeResult,
  ProposedFeatures,
  PublishDiagnosticsParams,
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

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize(_params => {
  const result: InitializeResult = {
    capabilities: {
      hoverProvider: true,
      textDocumentSync: TextDocumentSyncKind.Incremental
      // Tell the client that this server supports code completion.
      // completionProvider: {
      //   resolveProvider: true
      // }
    }
  };

  return result;
});

connection.onExit(() => carp.quit());

connection.onHover(async (document, _token, _progressReporter) => {
  return carp.hover({
    filePath: stripFileProtocol(document.textDocument.uri),
    line: document.position.line + 1,
    column: document.position.character
  });
});

documents.onDidSave(document => {
  diagnosticsCache.forEach(uri => {
    connection.sendDiagnostics({
      uri,
      diagnostics: []
    });
  });

  diagnosticsCache.clear();

  carp
    .check({ filePath: stripFileProtocol(document.document.uri) })
    .then(res => {
      console.log('got this res:');
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
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
