import { existsSync, readFileSync, writeFileSync, watch } from 'fs'
import { join, resolve, relative, dirname } from 'path'
import { parse } from 'json-parse-helpfulerror'
import { isEqual } from 'lodash'
import { bold, cyan, gray, red, green } from 'chalk'
import enableDestroy from 'server-destroy'
import pause from 'connect-pause'
import { URL, FILE } from './utils/is'
import load from './utils/load'
import { create, router as _router, defaults as _defaults, rewriter as _rewriter } from '../index'
import * as low from 'lowdb'
import type { MiddlewaresOptions } from 'json-server'
import type * as express from 'express'
import type * as http from 'http'

const shimAppDb = (e: express.Application) => e as express.Application & { db: low.LowdbSync<any> }

function prettyPrint(argv: Record<string, any>, object: Record<string, any>, rules: Record<string, any>) {
  const root = `http://${argv.host}:${argv.port}`

  console.log()
  console.log(bold('  Resources'))
  for (const prop in object) {
    console.log(`  ${root}/${prop}`)
  }

  if (rules) {
    console.log()
    console.log(bold('  Other routes'))
    for (const rule in rules) {
      console.log(`  ${rule} -> ${rules[rule]}`)
    }
  }

  console.log()
  console.log(bold('  Home'))
  console.log(`  ${root}`)
  console.log()
}

function createApp(
  db: low.LowdbSync<any>,
  routes: Record<string, string>,
  middlewares: express.RequestHandler,
  argv: Argv
) {
  const app = create()

  const { foreignKeySuffix } = argv

  const router = _router(
    db,
    foreignKeySuffix ? { foreignKeySuffix } : undefined
  )

  const defaultsOpts: MiddlewaresOptions = {
    logger: !argv.quiet,
    readOnly: argv.readOnly,
    noCors: argv.noCors,
    noGzip: argv.noGzip,
    bodyParser: true,
  }

  if (argv.static) {
    defaultsOpts.static = join(process.cwd(), argv.static)
  }

  const defaults = _defaults(defaultsOpts)
  app.use(defaults)

  if (routes) {
    const rewriter = _rewriter(routes)
    app.use(rewriter)
  }

  if (middlewares) {
    app.use(middlewares)
  }

  if (argv.delay) {
    app.use(pause(argv.delay))
  }

  (router.db._ as unknown as Record<string, string>).id = argv.id
  shimAppDb(app).db = router.db
  app.use(router)

  return app
}

export default async function (argv: Argv) {
  const source = argv._[0]
  let app: express.Application
  let server: http.Server | undefined

  if (!existsSync(argv.snapshots)) {
    console.log(`Error: snapshots directory ${argv.snapshots} doesn't exist`)
    process.exit(1)
  }

  // noop log fn
  if (argv.quiet) {
    console.log = () => { }
  }

  console.log()
  console.log(cyan('  \\{^_^}/ hi!'))

  async function start() {
    console.log()

    console.log(gray('  Loading', source))

    server = undefined

    // create db and load object, JSON file, JS or HTTP database
    const sourceAdapter = await load(source)
    const db = low.default(sourceAdapter as unknown as low.AdapterSync)

    // Load additional routes
    let routes
    if (argv.routes) {
      console.log(gray('  Loading', argv.routes))
      routes = JSON.parse(readFileSync(argv.routes, 'utf-8'))
    }

    // Load middlewares
    let middlewares!: express.RequestHandler
    if (argv.middlewares) {
      middlewares = argv.middlewares.map(function (m) {
        console.log(gray('  Loading', m))
        return require(resolve(m))
      }) as unknown as express.RequestHandler
    }

    // Done
    console.log(gray('  Done'))

    // Create app and server
    app = createApp(db, routes, middlewares, argv)
    server = app.listen(argv.port, argv.host)

    // Enhance with a destroy function
    enableDestroy(server)

    // Display server informations
    prettyPrint(argv, db.getState(), routes)

    // Catch and handle any error occurring in the server process
    process.on('uncaughtException', (error: any) => {
      if (error.errno === 'EADDRINUSE')
        console.log(
          red(
            `Cannot bind to the port ${error.port}. Please specify another port number either through --port argument or through the json-server.json configuration file`
          )
        )
      else
        console.log('Some error occurred', error)
      process.exit(1)
    })

    return [sourceAdapter, db]
  }

  try {
    const [sourceAdapter, db] = await start()

    // Snapshot
    console.log(
      gray(
        '  Type s + enter at any time to create a snapshot of the database'
      )
    )

    // Support nohup
    // https://github.com/typicode/json-server/issues/221
    process.stdin.on('error', () => {
      console.log(`  Error, can't read from stdin`)
      console.log(`  Creating a snapshot from the CLI won't be possible`)
    })
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      if (chunk.trim().toLowerCase() === 's') {
        const filename = `db-${Date.now()}.json`
        const file = join(argv.snapshots, filename)
        const state = shimAppDb(app).db.getState()
        writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8')
        console.log(
          `  Saved snapshot to ${relative(process.cwd(), file)}\n`
        )
      }
    })

    // Watch files
    if (argv.watch) {
      console.log(gray('  Watching...'))
      console.log()
      const source = argv._[0]

      // Watch .js or .json file
      // Since lowdb uses atomic writing, directory is watched instead of file
      const watchedDir = source
      let readErrors = new Set<string>()
      watch(watchedDir, (event, file) => {
        // https://github.com/typicode/json-server/issues/420
        // file can be null
        if (file) {
          const watchedFile = resolve(watchedDir, file)
          if (FILE(watchedFile)) {
            try {
              parse(readFileSync(watchedFile, 'utf-8'))
              if (readErrors.has(watchedFile)) {
                console.log(green(`  Read error has been fixed :)`))
                readErrors.delete(watchedFile)
              }
            } catch (e) {
              readErrors.add(watchedFile)
              console.log(red(`  Error reading ${watchedFile}`))
              console.error(e.message)
              return
            }

            // Compare .json file content with in memory database
            const isDatabaseDifferent = !isEqual(sourceAdapter.read(), shimAppDb(app).db.getState())

            if (isDatabaseDifferent) {
              console.log(
                gray(`  ${source} has changed, reloading...`)
              )

              server && server.destroy(() => start())
            }
          }
        }
      })

      // Watch routes
      if (argv.routes) {
        const watchedDir = dirname(argv.routes)
        watch(watchedDir, (event, file) => {
          if (file) {
            const watchedFile = resolve(watchedDir, file)
            if (watchedFile === resolve(argv.routes as string)) {
              console.log(
                gray(`  ${argv.routes} has changed, reloading...`)
              )
              server && server.destroy(() => start())
            }
          }
        })
      }
    }
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}