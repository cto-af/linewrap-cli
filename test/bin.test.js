import {exec, spawn} from './harness.js'
import {EOL} from 'os'
import assert from 'assert/strict'
import {fileURLToPath} from 'url'
import fs from 'fs/promises'
import {main} from '../bin/linewrap.js'
import path from 'path'

let tmpDir = null
const HELP = [
  'Usage: linewrap [options] [...file]',
  '',
  'Wrap some text, either from file, stdin, or given on the command line.  Each',
  'chunk of text is wrapped independently from one another, and streamed to stdout',
  '(or an outFile, if given).  Command line arguments with -t/--text are processed',
  'before files.',
  '',
  'Arguments:',
  '  ...file                      files to wrap and concatenate.  Use "-" for',
  '                               stdin.',
  '',
  'Options:',
  '  -e,--encoding <encoding>     encoding for files read or written.  stdout is',
  '                               always in the default encoding. (choices:',
  '                               "ascii", "utf8", "utf-8", "utf16le", "ucs2",',
  '                               "ucs-2", "base64", "base64url", "latin1",',
  '                               "binary", "hex") Default: "utf8"',
  '  -h,--help                    display help for command',
  '  --html                       escape output for HTML',
  '  -i,--indent <string|number>  indent each line with this text.  If a number,',
  '                               indent that many spaces. Default: ""',
  '  -l,--locale <iso location>   locale for grapheme segmentation.  Has very',
  '                               little effect at the moment',
  '  -o,--outFile <file>          output to a file instead of stdout',
  '  --outdentFirst               Do not indent the first output line',
  '  --overflow <style>           what to do with words that are longer than width.',
  '                               (choices: "visible", "clip", "anywhere") Default:',
  '                               "visible"',
  '  -t,--text <value>            wrap this chunk of text.  If used, stdin is not',
  '                               processed unless "-" is used explicitly.  Can be',
  '                               specified multiple times. Default: []',
  '  -w,--width <columns>         maximum line length Default: "80"',
  '',
].join(EOL)

let argv1 = null
before('create tempdir', async() => {
  const prefix = new URL('ctoaf-linewrap-', import.meta.url)
  tmpDir = await fs.mkdtemp(fileURLToPath(prefix))
  // eslint-disable-next-line prefer-destructuring
  argv1 = process.argv[1]
  process.argv[1] = 'linewrap.js'
})

describe('cli', () => {
  it('generates help', async() => {
    const res = await exec({main, code: 64}, '-h')
    assert.equal(res.stderr, HELP)
  })

  it('reads stdin', async() => {
    const res = await exec({main, stdin: 'foo bar'}, '-w', '4')
    assert.equal(res.stdout, [
      'foo',
      'bar',
      '',
    ].join(EOL))
  })

  it('html escapes', async() => {
    const res = await exec({main, stdin: 'foo <b>bar</b>'}, '-w', '11', '--html')
    assert.equal(res.stdout, [
      'foo',
      '&lt;b&gt;bar&lt;/b&gt;', // Longer than 11!
      '',
    ].join(EOL))
  })

  it('deals with bad overflow types', async() => {
    await exec({main, code: 64}, '--overflow', 'foo')
  })

  it('reads and writes files', async() => {
    const outFile = path.join(tmpDir, 'foo')
    await exec({main, stdin: 'foo bar'}, '-w', '4', '-o', outFile)
    const contents = await fs.readFile(outFile, 'utf8')
    assert.equal(contents, [
      'foo',
      'bar',
      '',
    ].join(EOL))

    const readRes = await exec({main}, '-w', '2', '--overflow', 'clip', outFile)
    assert.equal(readRes.stdout, [
      'f\u{2026}',
      'b\u{2026}',
      '',
    ].join(EOL))
  })

  it('handles inputs on the cli', async() => {
    const res = await exec({main}, '-w', '4', '-t', 'foo bar')
    assert.equal(res.stdout, [
      'foo',
      'bar',
      '',
    ].join(EOL))
  })

  it('spawns', async() => {
    const mainJs = fileURLToPath(new URL('../bin/linewrap.js', import.meta.url))
    const res = await spawn({main: mainJs, code: 64}, '-h')
    assert.equal(res.stderr, HELP)

    const invalidInputFile = path.join(tmpDir, 'DOES_NOT_EXIST')
    const res2 = await spawn({main: mainJs, code: 1}, invalidInputFile)
    assert.match(res2.stderr, /ENOENT/)
  })
})

after('remove tempdir', async() => {
  process.argv[1] = argv1
  if (tmpDir) {
    await fs.rm(tmpDir, {
      recursive: true,
    })
  }
})
