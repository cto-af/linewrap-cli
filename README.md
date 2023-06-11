# @cto.af/linewrap-cli

A command-line interface (CLI) for the
[@cto.af/linewrap](https://github.com/cto-af/linewrap) project.

## Installation

```sh
npm install -g @cto.af/linewrap-cli
```

### Invocation

```txt
Usage: linewrap [options] [...file]

Wrap some text, either from file, stdin, or given on the command line.  Each
chunk of text is wrapped independently from one another, and streamed to stdout
(or an outFile, if given).  Command line arguments with -t/--text are processed
before files.

Arguments:
  ...file                        files to wrap and concatenate.  Use "-" for
                                 stdin. Default: "-"

Options:
  -7,--example7                  turn on the extra rules from Example 7 of UAX
                                 #14
  -c,--firstCol <value>          If outdentFirst is specified, how many columns
                                 was the first line already indented?  If NaN,
                                 use the indent width, in graphemes.  If
                                 outdentFirst is false, this is ignored Default:
                                 "NaN"
  -e,--encoding <encoding>       encoding for files read or written.  stdout is
                                 always in the default encoding. (choices:
                                 "ascii", "utf8", "utf-8", "utf16le", "ucs2",
                                 "ucs-2", "base64", "base64url", "latin1",
                                 "binary", "hex") Default: "utf8"
  --ellipsis <string>            What string to use when a word is longer than
                                 the max width, and in overflow mode "clip"
                                 Default: "…"
  -h,--help                      display help for command
  --html                         escape output for HTML
  --hyphen <string>              What string to use when a word is longer than
                                 the max width, and in overflow mode "any"
                                 Default: "-"
  -i,--indent <string|number>    indent each line with this text.  If a number,
                                 indent that many spaces Default: ""
  --indentChar <string>          if indent is a number, that many indentChars
                                 will be inserted before each line Default: " "
  --indentEmpty                  if the input string is empty, should we still
                                 indent? Default: false
  --isNewline <regex>            a regular expression to replace newlines in the
                                 input.  Empty to leave newlines in place.
                                 Default: "[^\\S\\r\\n\\v\\f\\x85\\u2028\
                                 \u2029]*[\\r\\n\\v\\f\\x85\\u2028\\u2029]+\\s*"
  -l,--locale <iso location>     locale for grapheme segmentation.  Has very
                                 little effect at the moment
  --newline <string>             how to separate the lines of output Default:
                                 "\n"
  --newlineReplacement <string>  when isNewline matches, replace with this
                                 string Default: " "
  -o,--outFile <file>            output to a file instead of stdout
  --outdentFirst                 Do not indent the first output line Default:
                                 false
  --overflow <style>             what to do with words that are longer than
                                 width. (choices: "visible", "clip",
                                 "anywhere") Default: "visible"
  -t,--text <value>              wrap this chunk of text.  If used, stdin is not
                                 processed unless "-" is used explicitly.  Can
                                 be specified multiple times. Default: []
  -v,--verbose                   turn on super-verbose information.  Not useful
                                 for anything but debugging underlying libraries
  -w,--width <columns>           maximum line length Default: "(your terminal
                                 width or 80)"
```

## Examples

```sh
linewrap -w 4 -t "foo bar"
echo -n "foo bar" | linewrap -w 4
linewrap -o outputFileName.txt -w 4 inputFileName.txt
```

---
[![Tests](https://github.com/cto-af/linewrap-cli/actions/workflows/node.js.yml/badge.svg)](https://github.com/cto-af/linewrap-cli/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/cto-af/linewrap-cli/branch/main/graph/badge.svg?token=D0hvqMS3Wx)](https://codecov.io/gh/cto-af/linewrap-cli)
