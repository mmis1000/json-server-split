import { bold, cyan, gray, green, red } from 'chalk'
import { watch } from 'chokidar'
import pause from 'connect-pause'
import * as express from 'express'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import type * as http from 'http'
import { parse } from 'json-parse-helpfulerror'
import type { MiddlewaresOptions } from 'json-server'
import { isEqual } from 'lodash'
import * as low from 'lowdb'
import { join, relative, resolve } from 'path'
import enableDestroy from 'server-destroy'
import vm from 'vm'
import { create, createRender, defaults as _defaults, rewriter as _rewriter, router as _router } from '../index'
import assetsFixerInfo from '../routes/assets-fixer-info'
import customRouter, { RouteInfo } from '../routes/custom-router'
import { FILE, JS } from './utils/is'
import load from './utils/load'

const shimAppDb = (e: express.Application) => e as express.Application & { db: low.LowdbSync<any> }

function prettyPrint(
  argv: Record<string, any>,
  object: Record<string, any>,
  rules: Record<string, any>,
  routers: RouteInfo[] | undefined,
  assetsFixUpMap: Record<string, string[]> | undefined
) {
  const root = `http://${argv.host}:${argv.port}`

  console.log()
  console.log(bold('  Resources'))

  for (const prop in object) {
    console.log(`  ${root}/${prop}`)
  }

  if (routers) {
    console.log()
    console.log(bold('  Programmed routes'))
    for (const rule of routers) {
      console.log(`  ${root}${rule.route} -> ${rule.relativePath}`)
    }
  }

  if (rules) {
    console.log()
    console.log(bold('  Other routes'))
    for (const rule in rules) {
      console.log(`  ${root}${rule} -> ${rules[rule]}`)
    }
  }

  if (assetsFixUpMap) {
    console.log()
    console.log(bold('  Assets path fixups'))
    for (const rule in assetsFixUpMap) {
      console.log(`  ${rule} -> ${assetsFixUpMap[rule].join(', ')}`)
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
  routers: RouteInfo[] | undefined,
  assetsFixUpMap: Record<string, string[]> | undefined,
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
  } else {
    const userDir = join(process.cwd(), 'public')
    const defaultDir = join(__dirname, '../../public')
    const staticDir = existsSync(userDir) ? userDir : defaultDir
    defaultsOpts.static = staticDir
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

  if (routers) {
    app.use(customRouter(routers))
  }

  if (assetsFixUpMap) {
    app.use(assetsFixerInfo(assetsFixUpMap))
      ; (router as any).render = createRender(
        assetsFixUpMap,
        argv['assets-url-base']
      )
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

  let serverRestartQueue = Promise.resolve()

  const restartServer = () => {
    serverRestartQueue = serverRestartQueue.then(() => new Promise<void>(resolve => {
      if (server) {
        server && server.destroy(() => {
          start(() => resolve(), true)
        })
      } else {
        resolve()
      }
    }))
  }

  async function start(cb?: () => void, isRestart?: boolean) {
    console.log()

    console.log(gray('  Loading', source))

    server = undefined

    // create db and load object, JSON file, JS or HTTP database
    const sourceAdapter = await load(String(source))
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

    let routers: RouteInfo[] | undefined = undefined
    // Load custom route handlers
    if (argv.routers) {
      const files = readdirSync(argv.routers)
        .filter(JS)

      console.log(gray(`  Loading custom routes`))
      routers = files.map(s => {
        const route = '/' + s.replace(/\.js$/, '').split(/--/g).map(s => s.replace(/^_/, ':')).join('/')
        const relativePath = join(argv.routers!, s)
        const scriptPath = require.resolve(resolve(relativePath))
        delete require.cache[scriptPath]
        const handler = require(scriptPath)
        console.log(gray(`    Adding route ${route} from ${relativePath}`))
        return {
          route,
          relativePath,
          handler
        }
      })
    }

    let assetsFixUpMap: Record<string, string[]> | undefined = undefined

    if (argv['assets-url-map']) {
      console.log(gray(`  Loading assets fixup map from ${argv['assets-url-map']}`))
      assetsFixUpMap = JSON.parse(readFileSync(argv['assets-url-map'], 'utf8'))
    }

    // Done
    console.log(gray('  Done'))

    // Create app and server
    app = createApp(db, routes, middlewares, routers, assetsFixUpMap, argv)
    server = app.listen(argv.port, argv.host, cb)

    // Enhance with a destroy function
    enableDestroy(server)

    // Display server informations
    prettyPrint(argv, db.getState(), routes, routers, assetsFixUpMap)

    // Catch and handle any error occurring in the server process
    if (!isRestart) {
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
    }

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
      const watchedDir = String(source)
      let readErrors = new Set<string>()

      watch(
        resolve(watchedDir),
        {
          ignoreInitial: true,
          cwd: resolve(watchedDir)
        }
      ).on('all', (event, file) => {
        const watchedFile = resolve(watchedDir, file)

        if (FILE(watchedFile) || JS(watchedFile)) {
          if (existsSync(resolve(watchedDir, file))) {
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
            } else /* if (JS(watchedFile)) */ {
              try {
                const file = readFileSync(watchedFile, 'utf-8')
                new vm.Script(file, { filename: file })

                if (readErrors.has(watchedFile)) {
                  console.log(green(`  Read error has been fixed :)`))
                  readErrors.delete(watchedFile)
                }
              } catch (e) {
                readErrors.add(watchedFile)
                console.log(red(`  Error reading ${watchedFile}`))
                console.error(e.stack)
                return
              }
            }
          } else {
            console.log(
              gray(`  ${file} has been removed`)
            )
          }

          // Compare old dir content with in memory database
          const latestSource = sourceAdapter.read()
          const isDatabaseDifferent = !isEqual(latestSource, shimAppDb(app).db.getState())

          if (isDatabaseDifferent) {
            console.log(
              gray(`  ${file} has changed, reloading...`)
            )

            // server && server.destroy(() => start())
            // restartServer()
            shimAppDb(app).db.setState(latestSource)
          }
        }
      })

      // Watch routers
      if (argv.routers) {
        const watchedDir = argv.routers
        watch(
          resolve(String(watchedDir)),
          {
            ignoreInitial: true,
            cwd: resolve(String(watchedDir))
          }
        ).on('all', (event, file) => {
          const watchedFile = resolve(watchedDir, file)

          console.log(
            gray(`  ${watchedFile} has changed, reloading...`)
          )

          // server && server.destroy(() => start())
          restartServer()
        })
      }


      // Watch routers
      if (argv.middlewares) {
        const middlewares = argv.middlewares
        watch(
          middlewares.map(it => resolve(it)),
          {
            ignoreInitial: true
          }
        ).on('all', (event, file) => {
          console.log(
            gray(`  ${file} has changed, reloading...`)
          )

          delete require.cache[require.resolve(resolve(file))]

          // server && server.destroy(() => start())
          restartServer()
        })
      }

      // Watch routes
      if (argv.routes) {
        watch(resolve(argv.routes), { ignoreInitial: true }).on('all', () => {
          console.log(
            gray(`  ${argv.routes} has changed, reloading...`)
          )
        })
      }
      // Watch assets fixups
      if (argv['assets-url-map']) {
        watch(resolve(argv['assets-url-map']), { ignoreInitial: true }).on('all', () => {
          console.log(
            gray(`  ${argv.routes} has changed, reloading...`)
          )
        })
      }
    }
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}