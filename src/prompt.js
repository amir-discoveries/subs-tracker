import readline from 'node:readline';

export function createAsk({ stdin, stdout }) {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
  ask.close = () => rl.close();
  return ask;
}
