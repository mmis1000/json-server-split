import { bold, cyan, gray, green, red } from 'chalk'
import { watch } from 'chokidar'
import pause from 'connect-pause'
import * as express from 'express'
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import type * as http from 'http'
import { parse } from 'json-parse-helpfulerror'
import type { MiddlewaresOptions } from 'json-server'
import { isEqual } from 'lodash'
import * as low from 'lowdb'
import { join, relative, resolve, dirname } from 'path'
import enableDestroy from 'server-destroy'
import vm from 'vm'
import { HookNames } from '../constants'
import { create, createRender, defaults as _defaults, rewriter as _rewriter, router as _router } from '../index'
import { Argv, HookContext, Hooks, RouteInfo } from '../interfaces'
import assetsFixerInfo from '../routes/assets-fixer-info'
import customRouter from '../routes/custom-router'
import { FILE, JS } from './utils/is'
import load from './utils/load'

const shimApp = (e: express.Application) => 
  e as express.Application & { db: low.LowdbSync<any>, currentJSONRouter: express.RequestHandler }

/**
 * 
 * @param {unknown} obj 
 */
 const importDefault = (obj: unknown) => {
  if (
    obj != null
    && typeof obj === 'object'
    && '__esModule' in obj
    && (obj as { __esModule: unknown })['__esModule'] === true
    && (obj as { default?: unknown }).default != null
  ) {
    return (obj as { default?: unknown }).default
  } else {
    return obj
  }
}

function runHook(
  name: HookNames,
  hooks: Hooks[],
  hookContext: HookContext,
  cb: () => void
) {
  for (const hook of hooks) {
    hook[`pre_${name}` as const]?.(hookContext)
  }
  cb()
  for (const hook of hooks) {
    hook[`post_${name}` as const]?.(hookContext)
  }
}

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
  middlewares: express.RequestHandler[] | undefined,
  routers: RouteInfo[] | undefined,
  assetsFixUpMap: Record<string, string[]> | undefined,
  hooks: Hooks[],
  hooksCtx: HookContext,
  argv: Argv
) {
  const app = create()
  hooksCtx.app = app

  const { foreignKeySuffix } = argv

  const router = _router(
    db,
    foreignKeySuffix ? { foreignKeySuffix } : undefined
  );
  (router.db._ as unknown as Record<string, string>).id = argv.id
  shimApp(app).db = router.db
  hooksCtx.router = router

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

  // HOOK: Default
  runHook(HookNames.Default, hooks, hooksCtx, () => {
    const defaults = _defaults(defaultsOpts)
    app.use(defaults)
  })

  // HOOK: Route
  runHook(HookNames.Route, hooks, hooksCtx, () => {
    if (routes) {
      const rewriter = _rewriter(routes)
      app.use(rewriter)
    }
  })

  // HOOK: Middlewares
  runHook(HookNames.Middlewares, hooks, hooksCtx, () => {
    if (middlewares) {
      app.use(middlewares)
    }
  })

  // HOOK: Delay
  runHook(HookNames.Delay, hooks, hooksCtx, () => {
    if (argv.delay) {
      app.use(pause(argv.delay!))
    }
  })

  // HOOK: Routers
  runHook(HookNames.Routers, hooks, hooksCtx, () => {
    if (routers) {
      app.use(customRouter(routers))
    }
  })

  if (assetsFixUpMap) {
    app.use(assetsFixerInfo(assetsFixUpMap));
    (router as any).render = createRender(
      assetsFixUpMap,
      argv['assets-url-base'],
      argv['assets-url-header']
    )
  }


  // HOOK: JSONRouter
  runHook(HookNames.JSONRouter, hooks, hooksCtx, () => {
    shimApp(app).currentJSONRouter = router
    app.use((req, res, next) => {
      shimApp(app).currentJSONRouter(req, res, next)
    })
    // app.use(router)
  })

  return app
}

function writeDbDefinition (
  dbFolderPath: string,
  definitionFilePath: string
) {
  const resolvedDbFolderPath = resolve(dbFolderPath)
  const resolvedDefinitionFilePath = resolve(definitionFilePath)

  const files = readdirSync(resolvedDbFolderPath)
  const dbFiles = files.filter(f => JS(f) || (FILE(f) && !f.endsWith('.snapshot.json')))

  const info: Record<string, { hasDefault: boolean, filePath: string, keepExtension: boolean }> = {}

  for (const filePath of dbFiles) {
    const name = filePath.replace(/(\.template)?\.([jt]s|json)$/i, '')
    const keepExtension = /\.json$/i.test(filePath)
    const data = require(join(resolvedDbFolderPath, filePath))
    info[name] = {
      hasDefault: data.__esModule === true,
      keepExtension,
      filePath: join(resolvedDbFolderPath, filePath)
    }
  }

  function formatItem (
    definitionFilePath: string,
    propertyName: string,
    item: { hasDefault: boolean, keepExtension: boolean,filePath: string }
  ) {
    const relativePath = './' + relative(dirname(definitionFilePath), item.filePath).replace(/\\/g, '/')
    const fixedPath = item.keepExtension ? relativePath : relativePath.replace(/\.[^.]+$/, '')
    const isValidIdentifier = /^[0-9a-zA-Z_]+$/.test(propertyName)

    return `  ${isValidIdentifier ? propertyName : JSON.stringify(propertyName)}: `
      + `typeof import(${JSON.stringify(fixedPath)})${item.hasDefault ? '[\"default\"]' : ''}`
  }

  const pairs = Object.entries(info).sort((i, j) => i[0] === j[0] ? 0 : i[0] < j[0] ? -1 : 1)

  let definition = `// eslint-disable
// THIS FILE IS AUTO GENERATED, DO NOT MODIFY
interface Database {
${pairs.map(p => formatItem(resolvedDefinitionFilePath, p[0], p[1]) + '\n').join('')}}

export default Database
`
  writeFileSync(definitionFilePath, definition)
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

  let pendingRestart = 0
  let serverRestartQueue = Promise.resolve()

  const restartServer = async () => {
    if (pendingRestart > 0) {
      // There is already a restart scheduled
      return
    }

    pendingRestart++
    serverRestartQueue = serverRestartQueue
    .then(() => {
      return start(true)
    })
    .catch((e) => {
      console.error(red('Failed to construct new server'))
      console.error(e.stack)
      throw e
    })
    .then(([startServer]) =>  {
      if (server) {
        return new Promise((resolve, reject) => {
          server && server.destroy(() => {
            console.log('Old server stopped')
            server = undefined
            return startServer().then(resolve, (err: Error) => {
              console.error(red('Failed to start new server but old is killed'))
              reject(err)
            })
          })
        })
      } else {
        // looks like we didn't start the server successfully last time
        return startServer().catch((err) => {
          console.error(red('Failed to start new server'))
          throw err
        })
      }
    })
    .catch((e) => {
      console.error(red('Reload failed'))
      console.error(e.stack)
    })
    .then(() => {
      pendingRestart--
    })
  }

  async function start(isRestart?: boolean) {
    console.log()

    console.log(gray('  Loading', source))

    // server = undefined

    // create db and load object, JSON file, JS or HTTP database
    const sourceAdapter = await load(String(source))
    const db = low.default(sourceAdapter as unknown as low.AdapterSync)

    if (argv['generate-ts-definition']) {
      console.log(gray(`  Writing definition file ${argv['generate-ts-definition']}`))
      writeDbDefinition(String(source), argv['generate-ts-definition'])
    }

    // Load additional routes
    let routes: Record<string, any> = {}
    if (argv.routes) {
      console.log(gray(`  Loading routes ${argv.routes}`))
      routes = JSON.parse(readFileSync(argv.routes, 'utf-8'))
    }

    // Load middlewares
    let middlewares: express.RequestHandler[] | undefined = undefined
    if (argv.middlewares) {
      console.log(gray('  Loading middlewares'))
      middlewares = argv.middlewares.map(function (middleware) {
        const resolved = resolve(middleware)
        const stat = statSync(resolved)

        if (stat.isFile()) {
          console.log(gray('    Adding ', resolved))
          const scriptPath = require.resolve(resolved)
          delete require.cache[scriptPath]
          return [importDefault(require(scriptPath)) as (...args: any[]) => void]
        } else {
          const routes: express.RequestHandler[] = []
          const files = readdirSync(resolved).filter(it => /\.[jt]s$/.test(it))
          files.sort((a, b) => a.replace(/\.[jt]s$/, '') > b.replace(/\.[jt]s$/, '')  ? 1 : -1)
          for (let file of files) {
            const fullPath = resolve(resolved, file)
            console.log(gray('    Adding ', fullPath))
            const scriptPath = require.resolve(fullPath)
            delete require.cache[scriptPath]
            routes.push(importDefault(require(scriptPath)) as (...args: any[]) => void)
          }
          return routes
        }
      }).flat()
    }

    // Load custom route handlers
    let routers: RouteInfo[] | undefined = undefined
    if (argv.routers) {
      const files = readdirSync(argv.routers)
        .filter(JS)

      console.log(gray(`  Loading custom routes`))
      routers = files.map(s => {
        const route = '/' + s.replace(/\.[jt]s$/, '').split(/--/g).map(s => s.replace(/^_/, ':')).join('/')
        const relativePath = join(argv.routers!, s)
        const scriptPath = require.resolve(resolve(relativePath))
        delete require.cache[scriptPath]
        const handler = importDefault(require(scriptPath)) as (...args: any[]) => void
        console.log(gray(`    Adding route ${route} from ${relativePath}`))
        return {
          route,
          relativePath,
          handler
        }
      })
    }

    // Load hooks
    let hooks: Hooks[] = []
    let hooksCtx: HookContext = { db, routers }
    if (argv.hooks) {
      console.log(gray(`  Loading hooks`))
      for (const hookDirOrFile of argv.hooks) {
        const fullPath = resolve(hookDirOrFile)
        const stat = statSync(fullPath)

        if (stat.isFile()) {
          console.log(gray(`    Adding hook ${fullPath}`))
          const scriptPath = require.resolve(fullPath)
          delete require.cache[scriptPath]
          hooks.push(require(scriptPath))
        } else {
          const files = readdirSync(fullPath).filter(it => /\.[jt]s$/.test(it))
          for (const file of files) {
            console.log(gray(`    Adding hook ${join(fullPath, file)}`))
            const scriptPath = require.resolve(join(fullPath, file))
            delete require.cache[scriptPath]
            hooks.push(require(scriptPath))
          }
        }
      }
    }

    // Load assets map
    let assetsFixUpMap: Record<string, string[]> | undefined = undefined
    if (argv['assets-url-map']) {
      console.log(gray(`  Loading assets fixup map from ${argv['assets-url-map']}`))
      assetsFixUpMap = JSON.parse(readFileSync(argv['assets-url-map'], 'utf8'))
    }

    // Done
    console.log(gray('  Done'))

    // Create app and server
    app = createApp(db, routes, middlewares, routers, assetsFixUpMap, hooks, hooksCtx, argv)

    const finalizeStart = async () => {
      await new Promise<void>((resolve, reject) => {
        // HOOK: ServerStart
        runHook(HookNames.ServerStart, hooks, hooksCtx, () => {
          server = app.listen(argv.port, argv.host, resolve)
          server.once('error', reject)
          hooksCtx.server = server
        })
      })
  
      // Enhance with a destroy function
      enableDestroy(server!)
  
      // Display server information
      prettyPrint(argv, db.getState(), routes, routers, assetsFixUpMap)
  
      // Catch and handle any error occurring in the server process.
      // This should only be applied at first run, so a flag is required to indicate that.
      if (!isRestart) {
        process.on('uncaughtException', (error: any) => {
          if (error.code === 'EADDRINUSE')
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
    }
    return [finalizeStart, sourceAdapter, db, hooks, hooksCtx] as const
  }

  try {
    const [finalize, sourceAdapter, db, hooks, hooksCtx] = await start()

    await finalize()

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
        const state = shimApp(app).db.getState()
        writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8')
        console.log(
          `  Saved snapshot to ${relative(process.cwd(), file)}\n`
        )
      }
    })

    // Watch files
    if (argv.watch) {
      let service: import('ts-node').Service

      try {
        const tsNode = require('ts-node') as typeof import('ts-node')
        service = tsNode.create()
      } catch (err) {}

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
        console.log(
          gray(`  ${file} changed`)
        )
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
              } catch (e: any) {
                readErrors.add(watchedFile)
                console.log(red(`  Error reading ${watchedFile}`))
                console.error(e.message)
                return
              }
            } else /* if (JS(watchedFile)) */ {
              try {
                const file = readFileSync(watchedFile, 'utf-8')
                const fileTransformed = watchedFile.endsWith('.ts') 
                  ? service.compile(file, watchedFile) 
                  : file
                new vm.Script(fileTransformed, { filename: watchedFile })

                if (readErrors.has(watchedFile)) {
                  console.log(green(`  Read error has been fixed :)`))
                  readErrors.delete(watchedFile)
                }
              } catch (e: any) {
                readErrors.add(watchedFile)
                console.log(red(`  Error reading ${watchedFile}`))
                console.error(e.stack)
                return
              }
            }
          } else {
            readErrors.delete(watchedFile)
            console.log(
              gray(`  ${file} has been removed`)
            )
          }

          // Compare old dir content with in memory database
          const latestSource = sourceAdapter.read()
          const isDatabaseDifferent = !isEqual(latestSource, shimApp(app).db.getState())
          const isKeyDifferent = !isEqual(Object.keys(latestSource), Object.keys(shimApp(app).db.getState()))

          if (isDatabaseDifferent) {
            console.log(
              gray(`  ${file} has changed, reloading...`)
            )

            if (argv['generate-ts-definition']) {
              console.log(gray(`  Writing definition file ${argv['generate-ts-definition']}`))
              writeDbDefinition(String(source), argv['generate-ts-definition'])
            }

            // server && server.destroy(() => start())
            // restartServer()
            shimApp(app).db.setState(latestSource)

            // also reload the json router on key change
            if (isKeyDifferent) {
              const newRouter = _router(
                db,
                argv.foreignKeySuffix ? { foreignKeySuffix: argv.foreignKeySuffix } : undefined
              );
              (newRouter.db._ as unknown as Record<string, string>).id = argv.id
              shimApp(app).db = newRouter.db

              runHook(HookNames.JSONRouterReload, hooks, hooksCtx, () => {
                shimApp(app).currentJSONRouter = newRouter
                hooksCtx.router = newRouter
              })
            }
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


      // Watch middlewares
      if (argv.middlewares) {
        const middlewares = argv.middlewares
        for (const middleware of argv.middlewares) {
          const fullPath = resolve(middleware)
          watch(
            fullPath,
            {
              ignoreInitial: true,
              cwd: fullPath
            }
          ).on('all', (event, file) => {
            const filePath = join(fullPath, file)
            console.log(
              gray(`  ${filePath} has changed, reloading...`)
            )
            try {
              const scriptPath = require.resolve(join(fullPath, file))
              delete require.cache[scriptPath]
            } catch (err) { /* ignores intentionally, because it can be removed or actually a dir */ }
            restartServer()
          })
        }
      }

      // Watch hooks
      if (argv.hooks) {
        for (const hookDirOrFile of argv.hooks) {
          const fullPath = resolve(hookDirOrFile)

          watch(
            fullPath,
            {
              ignoreInitial: true,
              cwd: fullPath
            }
          ).on('all', (event, file) => {
            const filePath = join(fullPath, file)
            console.log(
              gray(`  ${filePath} has changed, reloading...`)
            )
            try {
              const scriptPath = require.resolve(join(fullPath, file))
              delete require.cache[scriptPath]
            } catch (err) { /* ignores intentionally, because it can be removed or actually a dir */ }
            restartServer()
          })
        }
      }

      // Watch routes
      if (argv.routes) {
        watch(resolve(argv.routes), { ignoreInitial: true }).on('all', () => {
          console.log(
            gray(`  ${argv.routes} has changed, reloading...`)
          )

          restartServer()
        })
      }

      // Watch assets fixups
      if (argv['assets-url-map']) {
        watch(resolve(argv['assets-url-map']), { ignoreInitial: true }).on('all', () => {
          console.log(
            gray(`  ${argv.routes} has changed, reloading...`)
          )

          restartServer()
        })
      }
    }

    // for test
    if (process.send) {
      process.send({ type: 'ready' })
    }
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}