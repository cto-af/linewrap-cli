#!/usr/bin/env node
/* eslint-disable no-console */

import {LineWrap} from '@cto.af/linewrap'
import fs from 'fs'
import os from 'os'
import {parseArgsWithHelp} from 'minus-h'

/**
 * @type {Parameters<generateHelp>[0]}
 */
const options = {
  options: {
    encoding: {
      short: 'e',
      type: 'string',
      default: 'utf8',
      argumentName: 'encoding',
      description: 'encoding for files read or written.  stdout is always in the default encoding. (choices: "ascii", "utf8", "utf-8", "utf16le", "ucs2", "ucs-2", "base64", "base64url", "latin1", "binary", "hex")',
    },
    html: {type: 'boolean', description: 'escape output for HTML'},
    indent: {
      short: 'i',
      type: 'string',
      default: '',
      argumentName: 'string|number',
      description: 'indent each line with this text.  If a number, indent that many spaces.',
    },
    locale: {
      short: 'l',
      type: 'string',
      argumentName: 'iso location',
      description: 'locale for grapheme segmentation.  Has very little effect at the moment',
    },
    outdentFirst: {
      type: 'boolean',
      description: 'Do not indent the first output line',
    },
    outFile: {
      short: 'o',
      type: 'string',
      argumentName: 'file',
      description: 'output to a file instead of stdout',
    },
    overflow: {
      type: 'string',
      default: 'visible',
      argumentName: 'style',
      description: 'what to do with words that are longer than width.  (choices: "visible", "clip", "anywhere")',
    },
    text: {
      short: 't',
      type: 'string',
      multiple: true,
      default: [],
      description: 'wrap this chunk of text.  If used, stdin is not processed unless "-" is used explicitly.  Can be specified multiple times.',
    },
    width: {
      short: 'w',
      type: 'string',
      default: String(process.stdout.columns),
      argumentName: 'columns',
      description: 'maximum line length',
    },
  },
  allowPositionals: true,
  argumentName: '...file',
  argumentDescription: 'files to wrap and concatenate.  Use "-" for stdin.',
  description: 'Wrap some text, either from file, stdin, or given on the command line.  Each chunk of text is wrapped independently from one another, and streamed to stdout (or an outFile, if given).  Command line arguments with -t/--text are processed before files.',
}

const {
  values: opts,
  positionals: args,
} = parseArgsWithHelp(options)

if ((opts.text.length === 0) && (args.length === 0)) {
  args.push('-')
}

const overflow = {
  visible: LineWrap.OVERFLOW_VISIBLE,
  clip: LineWrap.OVERFLOW_CLIP,
  anywhere: LineWrap.OVERFLOW_ANYWHERE,
}[opts.overflow]

if (!overflow) {
  console.error(`Invalid overflow type "${opts.overflow}".  Must be one of "visible", "clip", or "anywhere".`)
  process.exit(64)
}

/**
 * Read stdin to completion with the configured encoding.
 *
 * @returns {Promise<string>}
 */
function readStdin() {
  // Below, d will be a string
  process.stdin.setEncoding(opts.encoding)
  return new Promise((resolve, reject) => {
    let s = ''
    process.stdin.on('data', d => (s += d))
    process.stdin.on('end', () => resolve(s))
    process.stdin.on('error', reject)
  })
}

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
  '\xA0': '&nbsp;',
}

/**
 * Escape HTML
 *
 * @param {string} str String containing prohibited characters.
 * @returns {string} Escaped string.
 * @private
 */
function htmlEscape(str) {
  return str.replace(/[&<>\xA0]/g, m => ESCAPES[m])
}

const outstream = opts.outFile ?
  fs.createWriteStream(opts.outFile, opts.encoding) :
  process.stdout // Don't set encoding, will confuse terminal.

async function main() {
  const w = new LineWrap({
    escape: opts.html ? htmlEscape : s => s,
    width: parseInt(opts.width, 10),
    locale: opts.locale,
    indent: parseInt(opts.indent, 10) || opts.indent,
    indentFirst: !opts.outdentFirst,
    newline: os.EOL,
    overflow,
    trim: !opts.noTrim,
  })

  for (const t of opts.text) {
    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  for (const f of args) {
    const t = f === '-' ?
      await readStdin() :
      await fs.promises.readFile(f, opts.encoding)

    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  outstream.end()
}

main().catch(e => {
  console.log(e.message)
  process.exit(1)
})
