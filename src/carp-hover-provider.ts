import * as vscode from 'vscode';

export default class CarpHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    return {
      contents: [
        {
          value: [
            `Hello, from CodeLens!`,
            `__Line__: ${position.line}`,
            `__Char__: ${position.character}`
          ].join('\n'),
          language: 'carp',
          isTrusted: true
        }
      ]
    };
  }
}
