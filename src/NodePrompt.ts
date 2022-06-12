import readline from 'readline';
import util from 'util';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

export const prompt: (question: string) => Promise<string> = util.promisify(rl.question).bind(rl);