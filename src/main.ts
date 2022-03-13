import Carp from './carp';

async function main() {
  const carp = new Carp();

  await carp
    .textDocumentDocumentSymbol({
      filePath: '/Users/oliverfencott/Desktop/projects/carp-vscode/test.carp'
    })
    .then(res => {
      console.log('textDocumentDocumentSymbol');
      console.log(res);
    });

  return carp.quit();
}

main();
