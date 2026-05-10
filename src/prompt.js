import readline from 'node:readline';

export function createAsk({ stdin, stdout }) {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  const buffered = [];
  const waiting = [];
  let closed = false;

  rl.on('line', (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()('');
  });

  const ask = (question) => new Promise((resolve) => {
    stdout.write(question);
    if (buffered.length) resolve(buffered.shift());
    else if (closed) resolve('');
    else waiting.push(resolve);
  });
  ask.close = () => rl.close();
  return ask;
}
