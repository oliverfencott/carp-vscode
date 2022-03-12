import Carp from './carp';

async function main() {
  const carp = new Carp();

  await carp
    .hover({
      filePath: '/Users/oliverfencott/Desktop/projects/carp-vscode/test.carp',
      line: 4,
      column: 13
    })
    .then(res => {
      console.log('Completed hover', res);
    });

  return carp.quit();
}

main();
