import updateNotifier from 'update-notifier'
import { config } from 'yargs'
import run from './run'
import fs from 'fs'
import { resolve, relative } from 'path'

// @ts-ignore
import pkg = require('../../package.json')

const pathKeys: (keyof Argv)[] = [
  'assets-url-map',
  'assetsUrlMap',

  'middlewares',
  'static',
  'routes',
  'routers'
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
          parsed[key] = relative(process.cwd(), resolve(base, parsed[key]))
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
        description: 'Paths to middleware files',
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
        description: 'Path to config file',
      },
      'assets-url-map': {
        type: 'string',
        description: 'Fixup map for assets url in response, use alongside --static to create full functional resource server. required for below option',
      },
      'assets-url-base': {
        type: 'string',
        description: 'New assets url base, defaults to request host or `ASSETS_PREFIX` header if not set',
      },
      routers: {
        type: 'string',
        description: 'Dir for custom logic for handling routes, happens before  the json and after the path rewrite',
      }
    })
    .help('help')
    .alias('help', 'h')
    .version(pkg.version)
    .alias('version', 'v')
    .example('$0 db', '')
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

https://github.com/typicode/json-server`)
    .require(1, 'Missing <source> argument')
    .parseSync()

  run(argv)
}
