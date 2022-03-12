// import { DiagnosticSeverity } from 'vscode';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  PublishDiagnosticsParams,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
// import Carp from './carp';
import Carp from './carp';

import path = require('path');

const carp = new Carp();

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

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
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onExit(() => {
  carp.quit();
});

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <ExampleSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }
});

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

function stripFileProtocol(path: string) {
  return path.replace('file://', '');
}

function addFileProtocol(path: string) {
  return 'file://' + path;
}

connection.onHover(async (document, _token, _progressReporter) => {
  return carp.hover({
    filePath: stripFileProtocol(document.textDocument.uri),
    line: document.position.line + 1,
    column: document.position.character
  });
});

connection.onDefinition(params => {
  return null;
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
  // const response = Carp.exec({
  //   filePath: change.document.uri
  // });
  // if (IS_DEV) {
  //   console.log('Is dev');
  //   if (response) {
  //     console.log('About to write file');
  //     writeFile(
  //       path.join('../carp-vscode/__TEST-OUTPUT__.json'),
  //       JSON.stringify(response, null, 2)
  //     )
  //       .then(() => {
  //         console.log('Wrote file');
  //       })
  //       .catch(e => {
  //         console.log(e);
  //         console.log('Error writing file');
  //       });
  //   } else {
  //     console.log("Didn't get a response from server");
  //   }
  // } else {
  //   console.log("Somehow isn't dev");
  // }
  // return Promise.resolve();
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VS Code
  connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: 'TypeScript',
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: 'JavaScript',
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    item.detail = 'TypeScript details';
    item.documentation = 'TypeScript documentation';
  } else if (item.data === 2) {
    item.detail = 'JavaScript details';
    item.documentation = 'JavaScript documentation';
  }
  return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
