#!/usr/bin/env node
/* eslint-disable no-console */

import {LineWrap} from '@cto.af/linewrap'
import {fileURLToPath} from 'url'
import fs from 'fs'
import os from 'os'
import {parseArgsWithHelp} from 'minus-h'
import {promisify} from 'util'

/**
 * @type {Parameters<generateHelp>[0]}
 */
const config = {
  options: {
    encoding: {
      short: 'e',
      type: 'string',
      default: 'utf8',
      argumentName: 'encoding',
      description: 'encoding for files read or written.  stdout is always in the default encoding.',
      choices: ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'],
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
      description: 'what to do with words that are longer than width.',
      choices: ['visible', 'clip', 'anywhere'],
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
      default: String(process.stdout.columns ?? 80),
      argumentName: 'columns',
      description: 'maximum line length',
    },
  },
  allowPositionals: true,
  argumentName: '...file',
  argumentDescription: 'files to wrap and concatenate.  Use "-" for stdin.',
  description: 'Wrap some text, either from file, stdin, or given on the command line.  Each chunk of text is wrapped independently from one another, and streamed to stdout (or an outFile, if given).  Command line arguments with -t/--text are processed before files.',
}

/**
 * Read stdin to completion with the configured encoding.
 *
 * @returns {Promise<string>}
 */
function readStdin(opts, stream) {
  // Below, d will be a string
  stream.setEncoding(opts.encoding)
  return new Promise((resolve, reject) => {
    let s = ''
    stream.on('data', d => (s += d))
    stream.on('end', () => resolve(s))
    stream.on('error', reject)
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

const {
  exit, stdin, stdout, stderr,
} = process

export async function main(
  extraConfig,
  options,
  process = {exit, stdin, stdout, stderr}
) {
  const {values, positionals} = parseArgsWithHelp({
    ...config,
    ...extraConfig,
  }, {
    width: config.options.width.default,
    ...options,
  })

  if ((values.text.length === 0) && (positionals.length === 0)) {
    positionals.push('-')
  }

  /** @type synbol */
  const overflow = {
    visible: LineWrap.OVERFLOW_VISIBLE,
    clip: LineWrap.OVERFLOW_CLIP,
    anywhere: LineWrap.OVERFLOW_ANYWHERE,
  }[values.overflow]

  const outstream = values.outFile ?
    fs.createWriteStream(values.outFile, values.encoding) :
    process.stdout // Don't set encoding, will confuse terminal.

  const w = new LineWrap({
    escape: values.html ? htmlEscape : s => s,
    width: parseInt(values.width, 10),
    locale: values.locale,
    indent: parseInt(values.indent, 10) || values.indent,
    indentFirst: !values.outdentFirst,
    newline: os.EOL,
    overflow,
    trim: !values.noTrim,
  })

  for (const t of values.text) {
    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  for (const f of positionals) {
    const t = f === '-' ?
      await readStdin(values, process.stdin) :
      await fs.promises.readFile(f, values.encoding)

    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  // Be careful to wait for the file to close, to ensure tests run
  // correctly.
  await promisify(outstream.end.bind(outstream))()
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
