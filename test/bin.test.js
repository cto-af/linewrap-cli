import {DEFAULTS, main} from '../bin/linewrap.js';
import {exec, spawn} from './harness.js';
import {Buffer} from 'node:buffer';
import {EOL} from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {test} from 'node:test';

DEFAULTS.width = 80;
let tmpDir = null;
const HELP = [
  'Usage: linewrap [options] [...file]',
  '',
  'Wrap some text, either from file, stdin, or given on the command line.  Each',
  'chunk of text is wrapped independently from one another, and streamed to stdout',
  '(or an outFile, if given).  Command line arguments with -t/--text are processed',
  'before files.',
  '',
  'Arguments:',
  '  ...file                        files to wrap and concatenate.  Use "-" for',
  '                                 stdin. Default: "-"',
  '',
  'Options:',
  '  -c,--firstCol <value>          If outdentFirst is specified, how many columns',
  '                                 was the first line already indented?  If NaN,',
  '                                 use the indent width, in graphemes.  If',
  '                                 outdentFirst is false, this is ignored Default:',
  '                                 "NaN"',
  '  -e,--encoding <encoding>       encoding for files read or written.  stdout is',
  '                                 always in the default encoding. (choices:',
  '                                 "ascii", "utf8", "utf-8", "utf16le", "ucs2",',
  '                                 "ucs-2", "base64", "base64url", "latin1",',
  '                                 "binary", "hex") Default: "utf8"',
  '  --ellipsis <string>            What string to use when a word is longer than',
  '                                 the max width, and in overflow mode "clip" ',
  '                                 Default: "…"',
  '  -h,--help                      display help for command',
  '  --html                         escape output for HTML',
  '  --hyphen <string>              What string to use when a word is longer than',
  '                                 the max width, and in overflow mode "any" ',
  '                                 Default: "-"',
  '  -i,--indent <string|number>    indent each line with this text.  If a number,',
  '                                 indent that many spaces Default: ""',
  '  --indentChar <string>          if indent is a number, that many indentChars',
  '                                 will be inserted before each line Default: " "',
  '  --indentEmpty                  if the input string is empty, should we still',
  '                                 indent? Default: false',
  '  -l,--locale <iso location>     locale for grapheme segmentation.  Has very',
  '                                 little effect at the moment',
  '  --newline <string>             how to separate the lines of output Default:',
  '                                 "\\n"',
  '  --newlineReplacement <string>  when isNewline matches, replace with this',
  '                                 string Default: " "',
  '  -o,--outFile <file>            output to a file instead of stdout',
  '  --outdentFirst                 Do not indent the first output line Default:',
  '                                 false',
  '  --overflow <style>             what to do with words that are longer than',
  '                                 width. (choices: "visible", "clip",',
  '                                 "anywhere") Default: "visible"',
  '  -t,--text <value>              wrap this chunk of text.  If used, stdin is not',
  '                                 processed unless "-" is used explicitly.  Can',
  '                                 be specified multiple times. Default: []',
  '  -v,--verbose                   turn on super-verbose information.  Not useful',
  '                                 for anything but debugging underlying libraries',
  '  -w,--width <columns>           maximum line length Default: "80"',
  '',
].join(EOL);

let argv1 = null;
const prefix = new URL('ctoaf-linewrap-', import.meta.url);
tmpDir = await fs.mkdtemp(fileURLToPath(prefix));
// eslint-disable-next-line prefer-destructuring
argv1 = process.argv[1];
process.argv[1] = 'linewrap.js';

test('cli', async t => {
  t.after(async() => {
    process.argv[1] = argv1;
    if (tmpDir) {
      await fs.rm(tmpDir, {
        recursive: true,
      });
    }
  });

  await test('generates help', async() => {
    const res = await exec({main, code: 64}, '-h', '-w', '80');
    assert.equal(res.stderr, HELP);
  });

  await test('reads stdin', async() => {
    const res = await exec({main, stdin: 'foo bar'}, '-w', '4');
    assert.equal(res.stdout, [
      'foo',
      'bar',
      '',
    ].join(EOL));
  });

  await test('html escapes', async() => {
    const res = await exec({main, stdin: 'foo <b>bar</b>'}, '-w', '11', '--html');
    assert.equal(res.stdout, [
      'foo',
      '&lt;b&gt;bar&lt;/b&gt;', // Longer than 11!
      '',
    ].join(EOL));
  });

  await test('deals with bad overflow types', async() => {
    await exec({main, code: 64}, '--overflow', 'foo');
  });

  await test('reads and writes files', async() => {
    const outFile = path.join(tmpDir, 'rwFiles');
    await exec({main, stdin: 'foo bar'}, '-w', '4', '-o', outFile);
    const contents = await fs.readFile(outFile, 'utf8');
    assert.equal(contents, [
      'foo',
      'bar',
      '',
    ].join(EOL));

    const readRes = await exec({main}, '-w', '2', '--overflow', 'clip', outFile);
    assert.equal(readRes.stdout, [
      'f\u{2026}',
      'b\u{2026}',
      '',
    ].join(EOL));
  });

  await test('handles inputs on the cli', async() => {
    const res = await exec({main}, '-w', '4', '-t', 'foo bar');
    assert.equal(res.stdout, [
      'foo',
      'bar',
      '',
    ].join(EOL));
  });

  await test('has all of the options hooked up', async() => {
    const outFile = path.join(tmpDir, 'options');
    // --encoding
    await exec({main, stdin: Buffer.from('foo bar', 'utf16le')}, '-w', '4', '-e', 'utf16le', '-o', outFile);
    const contents = await fs.readFile(outFile, 'utf16le');
    assert.equal(contents, [
      'foo',
      'bar',
      '',
    ].join(EOL));

    // --ellipsis
    let res = await exec(
      {main, stdin: 'foo'}, '--ellipsis', '=', '--overflow', 'clip', '--width', '2'
    );
    assert.equal(res.stdout, 'f=\n');

    // --example7
    // × C694 × 002E × 0020 ÷ 0041 × 002E ÷ 0034 × 0020 ÷ BABB ÷
    res = await exec(
      {main, stdin: '\uC694\u002e\u0020\u0041\u002e\u0034\u0020\uBABB'}, '-w', '1'
    );

    // --firstCol
    // --indent
    // --outdentFirst
    res = await exec(
      {main, stdin: 'foo bar baz'}, '-w', '7', '-i', '2', '--outdentFirst', '-c', '0'
    );
    assert.equal(res.stdout, 'foo bar\n  baz\n');

    // --hyphen
    res = await exec(
      {main, stdin: 'foo'}, '--hyphen', '=', '--overflow', 'anywhere', '--width', '2'
    );
    assert.equal(res.stdout, 'f=\no=\no\n');

    // --indentChar
    res = await exec(
      {main, stdin: 'foo bar baz'}, '-w', '8', '-i', '2', '--indentChar', '12'
    );
    assert.equal(res.stdout, '1212foo\n1212bar\n1212baz\n');

    // --indentEmpty
    res = await exec(
      {main, stdin: ''}, '-i', '2', '--indentEmpty'
    );
    assert.equal(res.stdout, '  \n');

    // --locale
    // After reading UAX #29 again, I still don't think this changes
    // anything visible.

    // --newline
    res = await exec(
      {main, stdin: 'foo bar'}, '--newline', '=', '-w', '1'
    );
    assert.equal(res.stdout, 'foo=bar=');

    // --verbose
    res = await exec({main}, '-t', '', '-v');
    assert.notEqual('res.stdout', 'foo\n');
  });

  await test('spawns', async() => {
    const mainJs = fileURLToPath(new URL('../bin/linewrap.js', import.meta.url));
    const res = await spawn({main: mainJs, code: 64}, '-h');
    assert.equal(res.stderr, HELP);

    const invalidInputFile = path.join(tmpDir, 'DOES_NOT_EXIST');
    const res2 = await spawn({main: mainJs, code: 1}, invalidInputFile);
    assert.match(res2.stderr, /ENOENT/);
  });
});
