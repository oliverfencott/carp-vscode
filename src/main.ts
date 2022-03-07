// import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

// const program = spawn('carp');

// program.stdin.write(':e\n');

// let str = '';

// program.stdout.on('data', (data: Buffer) => {
//   str += data.toString();
// });

// program.on('close', () => {
//   console.log('Program ended');
// });

// program.stdin.write(':q\n');

// enum Action {
//   LoadFile,
//   TypeLookup,
//   Quit
// }

// class Carp {
//   private program: ChildProcessWithoutNullStreams;

//   constructor() {
//     this.program = spawn('carp');
//   }

//   action(action: Action) {
//     //
//   }
// }
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const EXECUTABLE_NAME = 'carp';
interface SpawnError {
  errno?: -2;
  code?: 'ENOENT';
  path?: string;
}

const decolorize = (str: string) => str.replace(/\x1B\[\d+m/gi, '');

const PROMPT = '--PROMPT--';
const STARTUP_ARGS = [
  `--eval-preload`,
  `(Project.config "prompt" "${PROMPT}")`
];

const program = spawn(EXECUTABLE_NAME, STARTUP_ARGS);

program.on('error', (e?: SpawnError) => {
  if (e && e.code && e.code == 'ENOENT' && e.path == EXECUTABLE_NAME) {
    console.log(`Couldn't find "${EXECUTABLE_NAME}" in path`);
  }
});

function send(command: string) {
  program.stdin.write(command + '\n');
}

let text = '';
const texts: string[] = [];

program.stdout.on('data', (data: Buffer) => {
  text += decolorize(data.toString());

  if (text.endsWith(PROMPT)) {
    // console.log('Latest text:', text);
    writeFileSync('output.txt', text);
    texts.push(text);
    text = '';
  }
});

send(':e');
send(':q');
