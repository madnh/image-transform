# Image Transform

CLI to help you to transform your images.


<!-- toc -->
* [Image Transform](#image-transform)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @madnh/image-transform
$ image-transform COMMAND
running command...
$ image-transform (--version|--version|-v)
@madnh/image-transform/0.0.1 darwin-x64 node-v18.16.0
$ image-transform --help [COMMAND]
USAGE
  $ image-transform COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`image-transform help [COMMANDS]`](#image-transform-help-commands)
* [`image-transform transform [FILE]`](#image-transform-transform-file)

## `image-transform help [COMMANDS]`

Display help for image-transform.

```
USAGE
  $ image-transform help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for image-transform.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.9/src/commands/help.ts)_

## `image-transform transform [FILE]`

Transform images.

```
USAGE
  $ image-transform transform [FILE] [-c <value>] [-p <value>] [--withEnlargement] [-w <value>] [-h <value>]
    [--nameFormat <value>] [--nameRemove <value>] [--jpg] [--png] [--webp] [--avif] [--keepMeta] [-o <value>] [--watch]
    [--watchInitial] [--concurrency <value>]

ARGUMENTS
  FILE  Images to transform, maybe single file, dir or glob pattern. Can ignore if use `--profile`

FLAGS
  -c, --configFile=<value>  [default: image-transform.config.json] Config file path
  -h, --height=number       Resize height, default is auto scale with width
  -o, --out=<value>         Output directory, if omit then use the same directory with input file
  -p, --profile=<value>     Profile name
  -w, --width=number        Resize width, default is auto scale with height
  --avif                    Export to avif
  --concurrency=<value>     [default: 1] Number of concurrent transform
  --jpg                     Export to jpg
  --keepMeta                Keep image meta data
  --nameFormat=<value>      [default: {name}.{ext}] Format of output file name
  --nameRemove=<value>      Remove part of file name
  --png                     Export to png
  --watch                   Watch file changes
  --watchInitial            Watch file changes, and run initial transform for current file
  --webp                    Export to webp
  --withEnlargement         Allow image enlargements

DESCRIPTION
  Transform images.

  Name format:
  {name} - new name (without ext)
  {ext} - new extension
  {orgName} - original file name
  {orgExt} - original file extension


EXAMPLES
  $ image-transform transform --profile apple-icons

  $ image-transform transform --profile apple-icons --config images-transform.json

  $ image-transform transform images/image-1.jpg --webp

  $ image-transform transform images/image-1.jpg --webp --width 500 --out images/optimized

  $ image-transform transform images/image-1.jpg --avif --png --height=300

  $ image-transform transform images/image-1.jpg -w 1000 --webp --avif --png --name-format='{name}@2x.{ext}'

  $ image-transform transform images/image-1.jpg --webp --name-remove=__raw
```

_See code: [dist/commands/transform.ts](https://github.com/madnh/image-transform/blob/v0.0.1/dist/commands/transform.ts)_
<!-- commandsstop -->
