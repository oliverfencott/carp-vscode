// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

// class HoverProvider implements vscode.HoverProvider {
//   provideHover(
//     document: vscode.TextDocument,
//     position: vscode.Position,
//     token: vscode.CancellationToken
//   ): vscode.ProviderResult<vscode.Hover> {
//     return {
//       contents: [
//         {
//           value: [
//             `Hello, from CodeLens!`,
//             `__Line__: ${position.line}`,
//             `__Char__: ${position.character}`
//           ].join('\n'),
//           language: 'carp',
//           isTrusted: true
//         }
//       ]
//     };
//   }
// }

export function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "carp-vscode" is now active!');

  // const hoverProvider = vscode.languages.registerHoverProvider(
  //   'carp',
  //   new CarpHoverProvider()
  // );

  // The server is implemented in node
  let serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'carp' }],
    outputChannelName: 'CarpLSP',
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'CarpLSP',
    'Carp Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  // context.subscriptions.push(client.start(), hoverProvider);
  context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
