import {Transform} from 'node:stream';
import assert from 'node:assert/strict';
import {spawn as spwn} from 'node:child_process';

// This is pulled out so that it can eventually be a separate project, once
// I figure out a better API for how to call main()

class ExitError extends Error {
  constructor(code) {
    super(`Exit: ${code}`);
    this.code = code;
  }
}

// Record things written through a stream.  Only works for 16kb chunks.
class Record extends Transform {
  // eslint-disable-next-line class-methods-use-this
  _transform(chunk, _encoding, callback) {
    callback(null, chunk);
  }
}

export async function exec({main, stdin, code = 0}, ...args) {
  const res = {
    stdin: new Record(),
    stdout: new Record(),
    stderr: new Record(),
    code: 0,
    error: null,
    exit(c) {
      throw new ExitError(c);
    },
  };

  stdin ??= '';
  res.stdin.end(stdin);
  res.stdout.setEncoding('utf8');
  res.stderr.setEncoding('utf8');

  try {
    await main({
      args,
      outputStream: res.stderr,
      exit: res.exit,
    }, {width: 80}, res);
  } catch (e) {
    if (e.code) {
      res.code = e.code;
    } else {
      res.error = e;
    }
  }
  res.stdin = stdin;
  res.stdout = res.stdout.read();
  res.stderr = res.stderr.read();

  if (code != null) {
    assert.equal(res.code, code);
  }
  return res;
}

export function spawn({main, stdin, code = 0}, ...args) {
  return new Promise((resolve, reject) => {
    stdin ??= '';
    const res = {
      stdin,
      stdout: new Record(),
      stderr: new Record(),
      code: 0,
      error: null,
    };
    const child = spwn(process.argv0, [main, ...args], {
      stdio: 'pipe',
      env: {
        ...process.env,
        COLUMNS: 80,
      },
    });
    child.on('error', reject);
    child.on('close', cd => {
      res.stdout = res.stdout.read();
      res.stderr = res.stderr.read();
      res.code = cd;
      assert.equal(cd, code);
      resolve(res);
    });
    res.stdout.setEncoding('utf8');
    child.stdout.pipe(res.stdout);
    res.stderr.setEncoding('utf8');
    child.stderr.pipe(res.stderr);
    child.stdin.end(stdin);
  });
}
