#!/usr/bin/env node

import {inspect, promisify} from 'node:util';
import {LineWrap} from '@cto.af/linewrap';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import {parseArgsWithHelp} from 'minus-h';

export const DEFAULTS = {
  width: process.stdout.columns ?? 80,
};

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
    ellipsis: {
      type: 'string',
      default: LineWrap.DEFAULT_OPTIONS.ellipsis,
      argumentName: 'string',
      description: 'What string to use when a word is longer than the max width, and in overflow mode "clip"',
    },
    firstCol: {
      short: 'c',
      type: 'string',
      default: 'NaN',
      description: 'If outdentFirst is specified, how many columns was the first line already indented?  If NaN, use the indent width, in graphemes.  If outdentFirst is false, this is ignored',
    },
    html: {type: 'boolean', description: 'escape output for HTML'},
    hyphen: {
      type: 'string',
      default: LineWrap.DEFAULT_OPTIONS.hyphen,
      argumentName: 'string',
      description: 'What string to use when a word is longer than the max width, and in overflow mode "any"',
    },
    indent: {
      short: 'i',
      type: 'string',
      default: '',
      argumentName: 'string|number',
      description: 'indent each line with this text.  If a number, indent that many spaces',
    },
    indentChar: {
      type: 'string',
      default: LineWrap.DEFAULT_OPTIONS.indentChar,
      argumentName: 'string',
      description: 'if indent is a number, that many indentChars will be inserted before each line',
    },
    indentEmpty: {
      type: 'boolean',
      default: LineWrap.DEFAULT_OPTIONS.indentEmpty,
      description: 'if the input string is empty, should we still indent?',
    },
    isNewline: {
      type: 'string',
      default: LineWrap.DEFAULT_OPTIONS.isNewline.source,
      argumentName: 'regex',
      description: 'a regular expression to replace newlines in the input.  Empty to leave newlines in place.',
    },
    locale: {
      short: 'l',
      type: 'string',
      // This would make the tests depend on current locale:
      // default: LineWrap.DEFAULT_OPTIONS.locale,
      argumentName: 'iso location',
      description: 'locale for grapheme segmentation.  Has very little effect at the moment',
    },
    newline: {
      type: 'string',
      default: os.EOL,
      argumentName: 'string',
      description: 'how to separate the lines of output',
    },
    newlineReplacement: {
      type: 'string',
      argumentName: 'string',
      default: LineWrap.DEFAULT_OPTIONS.newlineReplacement,
      description: 'when isNewline matches, replace with this string',
    },
    outdentFirst: {
      type: 'boolean',
      default: !LineWrap.DEFAULT_OPTIONS.indentFirst,
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
    verbose: {
      short: 'v',
      type: 'boolean',
      description: 'turn on super-verbose information.  Not useful for anything but debugging underlying libraries',
    },
    width: {
      short: 'w',
      type: 'string',
      default: String(DEFAULTS.width),
      argumentName: 'columns',
      description: 'maximum line length',
    },
  },
  allowPositionals: true,
  argumentName: '...file',
  argumentDescription: 'files to wrap and concatenate.  Use "-" for stdin. Default: "-"',
  description: 'Wrap some text, either from file, stdin, or given on the command line.  Each chunk of text is wrapped independently from one another, and streamed to stdout (or an outFile, if given).  Command line arguments with -t/--text are processed before files.',
};

/**
 * Read stdin to completion with the configured encoding.
 *
 * @returns {Promise<string>}
 */
function readStdin(opts, stream) {
  // Below, d will be a string
  stream.setEncoding(opts.encoding);
  return new Promise((resolve, reject) => {
    let s = '';
    stream.on('data', d => (s += d));
    stream.on('end', () => resolve(s));
    stream.on('error', reject);
  });
}

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
  '\xA0': '&nbsp;',
};

/**
 * Escape HTML
 *
 * @param {string} str String containing prohibited characters.
 * @returns {string} Escaped string.
 * @private
 */
function htmlEscape(str) {
  return str.replace(/[&<>\xA0]/g, m => ESCAPES[m]);
}

const {
  exit, stdin, stdout, stderr,
} = process;

export async function main(
  extraConfig,
  options,
  process = {exit, stdin, stdout, stderr}
) {
  config.options.width.default = String(DEFAULTS.width);
  const {values, positionals} = parseArgsWithHelp({
    ...config,
    ...extraConfig,
  }, {
    width: DEFAULTS.width,
    ...options,
  });

  if ((values.text.length === 0) && (positionals.length === 0)) {
    positionals.push('-');
  }

  // Always a valid string, due to choices enforcement
  /** @type synbol */
  const overflow = {
    visible: LineWrap.OVERFLOW_VISIBLE,
    clip: LineWrap.OVERFLOW_CLIP,
    anywhere: LineWrap.OVERFLOW_ANYWHERE,
  }[values.overflow];

  const outstream = values.outFile ?
    fs.createWriteStream(values.outFile, values.encoding) :
    process.stdout; // Don't set encoding, will confuse terminal.

  /** @type {ConstructorParameters<typeof LineWrap>[0]} */
  const opts = {
    escape: values.html ? htmlEscape : s => s,
    ellipsis: values.ellipsis,
    firstCol: parseInt(values.firstCol, 10),
    hyphen: values.hyphen,
    indent: parseInt(values.indent, 10) || values.indent,
    indentChar: values.indentChar,
    indentEmpty: values.indentEmpty,
    indentFirst: !values.outdentFirst,
    locale: values.locale,
    newline: values.newline,
    newlineReplacement: values.newlineReplacement,
    overflow,
    trim: !values.noTrim,
    verbose: values.verbose,
    width: parseInt(values.width, 10),
  };
  if (typeof values.isNewline === 'string') {
    opts.isNewline = (values.isNewline.length === 0) ?
      null :
      new RegExp(values.isNewline, 'gu');
  }
  if (values.verbose) {
    process.stdout.write(inspect(opts));
  }
  const w = new LineWrap(opts);

  for (const t of values.text) {
    outstream.write(w.wrap(t));
    outstream.write(values.newline);
  }

  for (const f of positionals) {
    const t = f === '-' ?
      await readStdin(values, process.stdin) :
      await fs.promises.readFile(f, values.encoding);

    outstream.write(w.wrap(t));
    outstream.write(values.newline);
  }

  // Be careful to wait for the file to close, to ensure tests run
  // correctly.
  await promisify(outstream.end.bind(outstream))();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
