import { writeFile } from 'fs/promises';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
import Carp from './carp';
import { IS_DEV } from './env';
import path = require('path');

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

// connection.onCodeLens(action => {
//   const state = Carp.getState();

//   if (state) {
//     return state.bindings.flatMap(binding => {
//       if (
//         !binding.info ||
//         !binding.type ||
//         'file://' + binding.info.file != action.textDocument.uri
//       ) {
//         return [];
//       }

//       return [
//         {
//           command: {
//             command: 'my-comm',
//             title: binding.type
//           },
//           range: {
//             start: {
//               character: binding.info.column,
//               line: binding.info.line - 1
//             },
//             end: {
//               character: binding.info.column + binding.symbol.length,
//               line: binding.info.line - 1
//             }
//           }
//         }
//       ];
//     });
//   }
// });

// @ts-ignore
connection.onHover((document, _token, _progressReporter) => {
  // document.position.
  return Carp.hover({
    filePath: document.textDocument.uri,
    ...document.position
  });
});

documents.onDidSave(change => {
  const response = Carp.exec({
    filePath: change.document.uri
  });

  if (IS_DEV) {
    console.log('Is dev');
    if (response) {
      console.log('About to write file');
      writeFile(
        path.join('../carp-vscode/__TEST-OUTPUT__.json'),
        JSON.stringify(response, null, 2)
      )
        .then(() => {
          console.log('Wrote file');
        })
        .catch(e => {
          console.log(e);
          console.log('Error writing file');
        });
    } else {
      console.log("Didn't get a response from server");
    }
  } else {
    console.log("Somehow isn't dev");
  }

  return Promise.resolve();
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
