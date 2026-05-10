import readline from 'node:readline';
import { UserError } from './errors.js';

export function createAsk({ stdin, stdout }) {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  const buffered = [];
  const waiting = [];
  let closed = false;

  rl.on('line', (line) => {
    const next = waiting.shift();
    if (next) next.resolve(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length) {
      waiting.shift().reject(new UserError('Input ended before all prompts were answered.'));
    }
  });

  const ask = (question) => new Promise((resolve, reject) => {
    stdout.write(question);
    if (buffered.length) resolve(buffered.shift());
    else if (closed) reject(new UserError('Input ended before all prompts were answered.'));
    else waiting.push({ resolve, reject });
  });
  ask.close = () => rl.close();
  return ask;
}
