// `npm run hash-password`: reads the admin password (not echoed on a terminal, or from
// stdin when piped) and prints the ADMIN_PASSWORD_HASH value (D-019). The password is
// never stored or logged; only the printed hash goes into .env or the Render env vars.
// At least 12 characters (Q-038).
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/admin.js';

async function readPassword() {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) {
    let text = '';
    for await (const chunk of stdin) text += chunk;
    return text.replace(/\r?\n$/, '');
  }
  stderr.write('Admin password: ');
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  let password = '';
  for await (const chunk of stdin) {
    for (const ch of chunk) {
      if (ch === '\u0003') process.exit(130); // Ctrl+C
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stderr.write('\n');
        return password;
      }
      password = ch === '\u007f' ? password.slice(0, -1) : password + ch;
    }
  }
  return password;
}

const password = await readPassword();
// Counted in characters (code points), not bytes. The password itself is never printed.
if ([...password].length < MIN_PASSWORD_LENGTH) {
  console.error(`The password must have at least ${MIN_PASSWORD_LENGTH} characters; nothing printed.`);
  process.exit(1);
}
console.log(await hashPassword(password));
