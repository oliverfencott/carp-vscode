import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  createConnection,
  DiagnosticSeverity,
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
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
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
  carp
    .check({ filePath: stripFileProtocol(document.document.uri) })
    .then(res => {
      const responses = res.split('<--->').map(s => s.trim());
      const messages: PublishDiagnosticsParams[] = responses.flatMap(
        message => {
          const ERROR_STRING = '[ERROR]\n';
          if (message.startsWith(ERROR_STRING)) {
            const [, rest] = message.split(ERROR_STRING);
            const [info, ...msg] = rest.split(' ');
            const [path, line, col] = info.split(':');

            return [
              {
                uri: addFileProtocol(path),
                diagnostics: [
                  {
                    severity: DiagnosticSeverity.Error,
                    message: msg.join(' '),
                    range: {
                      start: {
                        line: Number(line) - 1,
                        character: Number(col)
                      },
                      end: {
                        line: Number(line),
                        character: Number(col) + 1
                      }
                    }
                  }
                ]
              }
            ];
          }

          return [];
        }
      );

      console.log('RESPONSES:', responses);
      console.log('MESSAGES:', JSON.stringify(messages, null, 2));

      //       [ERROR]
      // /Users/oliverfencott/Desktop/projects/carp-vscode/examples/simple.carp:32:8 Trying to refer to an undefined symbol 'aaaaa'.
      // <--->

      messages.forEach(connection.sendDiagnostics);
    });
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
