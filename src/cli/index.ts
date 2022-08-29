import updateNotifier from 'update-notifier'
import { config } from 'yargs'
import run from './run'
import fs from 'fs'
import { resolve, relative } from 'path'

// don't import, just require. Typescript is dumb about file not in rootDir
const pkg = require('../../package.json')
import { BASE_URL_HEADER } from '../constants'
import { Argv } from '../interfaces'
import migrate from './migrate'

const pathKeys: (keyof Argv)[] = [
  'assets-url-map',
  'assetsUrlMap',

  'middlewares',
  'static',
  'routes',
  'routers',
  'hooks',

  'generatesTsDefinition',
  'generates-ts-definition'
]

export default function () {
  updateNotifier({ pkg }).notify()

  const argv = config(
    'config',  
    function (configPath) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

      const base = resolve(process.cwd(), configPath, '../')

      for (const key of pathKeys) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          if (Array.isArray(parsed[key])) {
            parsed[key] = parsed[key].map((p: string) => relative(process.cwd(), resolve(base, p)))
          } else {
            parsed[key] = relative(process.cwd(), resolve(base, parsed[key]))
          }
        }
      }

      return parsed
    })
    .usage('$0 [options] <source>')
    .options({
      port: {
        type: 'number',
        alias: 'p',
        description: 'Set port',
        default: 3000,
      },
      host: {
        type: 'string',
        alias: 'H',
        description: 'Set host',
        default: 'localhost',
      },
      watch: {
        type: 'boolean',
        alias: 'w',
        description: 'Watch file(s)',
      },
      routes: {
        type: 'string',
        alias: 'r',
        description: 'Path to routes file',
      },
      middlewares: {
        type: 'string',
        alias: 'm',
        array: true,
        description: 'Paths to middleware files/dirs',
      },
      static: {
        type: 'string',
        alias: 's',
        description: 'Set static files directory',
      },
      'read-only': {
        type: 'boolean',
        alias: 'ro',
        description: 'Allow only GET requests',
      },
      'no-cors': {
        type: 'boolean',
        alias: 'nc',
        description: 'Disable Cross-Origin Resource Sharing',
      },
      'no-gzip': {
        type: 'boolean',
        alias: 'ng',
        description: 'Disable GZIP Content-Encoding',
      },
      snapshots: {
        type: 'string',
        alias: 'S',
        description: 'Set snapshots directory',
        default: '.',
      },
      delay: {
        type: 'number',
        alias: 'd',
        description: 'Add delay to responses (ms)',
      },
      id: {
        type: 'string',
        alias: 'i',
        description: 'Set database id property (e.g. _id)',
        default: 'id',
      },
      foreignKeySuffix: {
        type: 'string',
        alias: 'fks',
        description: 'Set foreign key suffix (e.g. _id as in post_id)',
        default: 'Id',
      },
      quiet: {
        type: 'boolean',
        alias: 'q',
        description: 'Suppress log messages from output',
      },
      config: {
        type: 'string',
        alias: 'c',
        description: 'Path to config file, this won\'t be watched',
      },
      'assets-url-map': {
        type: 'string',
        description: 'Fixup map for assets url in response, use alongside --static to create full functional resource server. required for below option',
      },
      'assets-url-base': {
        type: 'string',
        description: 'New assets url base, defaults to request host or `assets-url-header`',
      },
      'assets-url-header': {
        type: 'string',
        default: BASE_URL_HEADER,
        description: 'Header to use as base path when header provided by request, has higher priority then `assets-url-base`',
      },
      routers: {
        type: 'string',
        description: 'Dir for custom logic for handling routes, happens before  the json and after the path rewrite',
      },
      hooks: {
        type: 'string',
        array: true,
        description: 'File or Dir that contains custom hook for alter the server ability',
      },
      generatesTsDefinition: {
        type: 'string',
        description: 'Generate typescript definition of db file at specified position',
      },
      migrate: {
        type: 'boolean',
        default: false,
        description: 'this option is used to convent the existing db.json file into new structure and exits immediately'
      }
    })
    .help('help')
    .alias('help', 'h')
    .version(pkg.version)
    .alias('version', 'v')
    .example('$0 db/', '')
    // .example('$0 file.js', '')
    // .example('$0 http://example.com/db.json', '')
    .epilog(`About The \`--routers\`

  Route was determined by file name
  Two hyphen was use as path separator
  Dash at start of segment marks the segment as a param

  Example router file name:
    test.js => router.get('/test', expressHandler)
    test-a.js => router.get('/test-a', expressHandler)
    test--a.js => router.get('/test/a', expressHandler)
    _arg--a.js => router.get('/:arg/a', expressHandler)
    arg--_a.js => router.get('/arg/:a, expressHandler)

Caveats

  Watch against javascript files only works properly when the file itself changed.
  Change in file included indirectly need a full restart to take effect.

https://github.com/mmis1000/json-server-split`)
    .require(1, 'Missing <source> argument')
    .parseSync()

  if (argv.migrate) {
    migrate(argv._[0] as string)
  } else {
    run(argv)
  }
}
