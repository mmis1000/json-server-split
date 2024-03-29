# JSON Server Split

This project extends [JSON Server](https://github.com/typicode/json-server)
to make it suit for large project better.

Most apis in `JSON Server` are keeps as is.

The extensions aim to allow users mock most of back-end patterns from command line instead of use `JSON Server` as a library and handle everything yourself.

## Table of contents

- [Usages](#usage)
- [Changes](#changes)
  - [The db file structure](#the-db-file-structure)
  - [Middleware can be pointed to a directory](#middleware-can-be-pointed-to-a-directory)
  - [Path in `--config` option now relatives to config file](#path-in---config-option-now-relatives-to-config-file)
  - [Watch works with middleware and anything need to be watched](#watch-works-with-middleware-and-anything-need-to-be-watched)
- [Extensions](#extensions)
  - [Programmed generation of certain db fields](#programmed-generation-of-certain-db-fields)
  - [Saved snapshot of generated data](#saved-snapshot-of-generated-data)
  - [Immutable record](#immutable-record)
  - [Volatile record](#volatile-record)
  - [Custom routes](#custom-routes)
  - [Rewrite response to make url work](#rewrite-response-to-make-url-work)
  - [Hooks](#hooks)
- [Programmed usage](#programmed-usage)
  - [As a `JSON Server` `render` function](#as-a-json-server-render-function)
  - [As a util function](#as-a-util-function)
- [Caveats](caveats)
  - [Watch on js works partially](#watch-on-js-works-partially)

## Usage

```bash
npx @mmis1000/json-server-split --help
```

```txt
json-server-split [options] <source>

Options:
  -c, --config                   Path to config file, this won't be watched
                                                                        [string]
  -p, --port                     Set port               [number] [default: 3000]
  -H, --host                     Set host        [string] [default: "localhost"]
  -w, --watch                    Watch file(s)                         [boolean]
  -r, --routes                   Path to routes file                    [string]
  -m, --middlewares              Paths to middleware files/dirs          [array]
  -s, --static                   Set static files directory             [string]
      --read-only, --ro          Allow only GET requests               [boolean]
      --no-cors, --nc            Disable Cross-Origin Resource Sharing [boolean]
      --no-gzip, --ng            Disable GZIP Content-Encoding         [boolean]
  -S, --snapshots                Set snapshots directory [string] [default: "."]
  -d, --delay                    Add delay to responses (ms)            [number]
  -i, --id                       Set database id property (e.g. _id)
                                                        [string] [default: "id"]
      --foreignKeySuffix, --fks  Set foreign key suffix (e.g. _id as in post_id)
                                                        [string] [default: "Id"]
  -q, --quiet                    Suppress log messages from output     [boolean]
      --assets-url-map           Fixup map for assets url in response, use
                                 alongside --static to create full functional
                                 resource server. required for below option
                                                                        [string]
      --assets-url-base          New assets url base, defaults to request host
                                 or `assets-url-header`                 [string]
      --assets-url-header        Header to use as base path when header provided
                                 by request, has higher priority then
                                 `assets-url-base`
                                             [string] [default: "ASSETS-PREFIX"]
      --routers                  Dir for custom logic for handling routes,
                                 happens before  the json and after the path
                                 rewrite                                [string]
      --hooks                    File or Dir that contains custom hook for alter
                                 the server ability                      [array]
      --generate-ts-definition   Generate typescript definition of db file at
                                 specified position                     [string]
      --migrate                  this option is used to convent the existing
                                 db.json file into new structure and exits
                                 immediately          [boolean] [default: false]
  -h, --help                     Show help                             [boolean]
  -v, --version                  Show version number                   [boolean]

Examples:
  bin.js db/

About The `--routers`

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

  Watch against javascript files only works properly when the file itself
  changed.
  Change in file included indirectly need a full restart to take effect.

https://github.com/mmis1000/json-server-split
```

## Changes

### The db file structure

db.json is no longer a big JSON.
It now splits by filename.

So the JSON size won't grow indefinitely when project becomes big

#### old structure

db.json

```json
{
  "a": [1, 2, 3],
  "b": [4, 5, 6]
}
```

#### new structure

db/a.json

```json
[1, 2, 3]
```

db/b.json

```json
[4, 5, 6]
```

### Middleware can be pointed to a directory

`middlewares` option can now be pointed to a directory instead of a file.

Only the top level files in that directory will be loaded as middlewares.
But any changed file in that will triggers a reload when `--watch` option is used

### Path in `--config` option now relatives to config file

This no longer results in file not found

files

```txt
/nest
  /db/
  /config.json
  /routes.json
```

config.json

```json
{
  "routes": "routes.json"
}
```

```txt
/ $ npx @mmis1000/json-server-split --config nest/config.json nest/db
```

### Watch works with middleware and anything need to be watched

**(See also [caveats](#watch-on-js-works-partially), reload js file still has some limitation)**

All files are watched now.
If the pointed path is a directory, then all file in the directory are watched.

Includes newly added `--routers` , `--assets-url-map`, `hooks`

You can just enable watch, edit them and the server will take care of the rest.

## Extensions

### Programmed generation of certain db fields

Use with some mock data generator for best effect.

db/a.template.js

```js
module.exports =
  new Array(1000).fill(0).map((, _) => ({ id: i, value: 0 }))
```

```txt
> curl http://localhost:3000/a

[{id:0,value:0}, {id:1,value:0}, ... , {id:199,value:0}]
```

### Saved snapshot of generated data

From previous example

```txt
PATCH /a/0
{ value: 1}
```

results in write back to disk like

```txt
db/a.template.js
db/a.snapshot.json
```

The following read will also now read `a.snapshot.json` instead

### Immutable record

End filename of the data as `.template.json` results in write back to `.snapshot.json` instead of file itself.

Makes git plays better with the mock data.

  You can now just exclude `.snapshot.json` from the git so it won't complains about dirty workspace every time.

before write

```txt
db/a.template.json
```

after write

```txt
db/a.template.json // untouched
db/a.snapshot.json // new!
```

### Volatile record

Same as above `Programmed generation of certain db fields` but end with `.js` instead of `.template.js`

The data never writes back to disk and gone after the reload.

### Custom routes

Instead of use the json server as library and hook yourself.
You can now just include custom route from cli.

#### Example

```bash
npx @mmis1000/json-server-split --routers routers db
```

```js
// simple
// routers/test.js
module.exports = (req, res) => {
  res.jsonp({ "hello": "world" })
}

// nested
// routers/test1--param.js
module.exports = (req, res) => {
  res.jsonp({ "hello": "world1" })
}

// with param
// routers/test2--_param.js
module.exports = (req, res) => {
  res.jsonp({ param: req.params.param })
}
```

```bash
curl 'http://localhost:3000/test'
# { "hello": "world" }
curl 'http://localhost:3000/test1/param'
# { "hello": "world1"}
curl 'http://localhost:3000/test2/qwerty'
# { "param": "qwerty" }
```

### Rewrite response to make url work

It was done by generate a custom `render` that remaps specified field.  
Useful if your response contains link to the `--static` folder.

#### Example

```bash
npx @mmis1000/json-server-split --assets-url-map assets-map.json db
```

db/assets.json

```json
{
  "id": 0,
  "title": "",
  "thumbs": {
    "url": "a.png",
    "unrelated": "a.png"
  },
  "images": [
    "a.jpg",
    "b.jpg"
  ]
}
```

assets-map.json

```json
{
  "/assets/*": ["thumbs.url", "images.*"]
}
```

```bash
curl http://localhost:3000/assets/0

# {
#   "id": 0,
#   "title": "",
#   "thumbs": {
#     "url": "http://localhost:3000/a.png",
#     "unrelated": "a.png"
#   },
#   "images": [
#     "http://localhost:3000/a.jpg",
#     "http://localhost:3000/b.jpg"
#   ]
# }
```

#### Specify the base if required

```bash
npx @mmis1000/json-server-split --assets-url-map assets-map.json --assets-url-base 'http://example.com/' db
curl http://localhost:3000/assets/0

# {
#   "id": 0,
#   "title": "",
#   "thumbs": {
#     "url": "http://example.com/a.png",
#     "unrelated": "a.png"
#   },
#   "images": [
#     "http://example.com/a.jpg",
#     "http://example.com/b.jpg"
#   ]
# }
```

#### Specify the base via request header

```bash
npx @mmis1000/json-server-split --assets-url-map assets-map.json db
curl -H "ASSETS-PREFIX=http%3A%2F%2Fexample.com%2F" http://localhost:3000/assets/0
```

And you got same output as previous one.

### Hooks

Inject points for you to alter the server, db, express app or json router instance.

Useful things like attach the ws module to the server for web socket related function.

#### Available types

```txt
-- Hook: pre_Default
   available props db, routers, app, router

-- Hook: post_Default
   available props db, routers, app, router

-- Hook: pre_Route
   available props db, routers, app, router

-- Hook: post_Route
   available props db, routers, app, router

-- Hook: pre_Middlewares
   available props db, routers, app, router

-- Hook: post_Middlewares
   available props db, routers, app, router

-- Hook: pre_Delay
   available props db, routers, app, router

-- Hook: post_Delay
   available props db, routers, app, router

-- Hook: pre_Routers
   available props db, routers, app, router

-- Hook: post_Routers
   available props db, routers, app, router

-- Hook: pre_JSONRouter
   available props db, routers, app, router

-- Hook: post_JSONRouter
   available props db, routers, app, router

-- Hook: pre_ServerStart
   available props db, routers, app, router

-- Hook: post_ServerStart
   available props db, routers, app, router, server

-- Hook: pre_JSONRouterReload
   available props db, routers, app, router, server

-- Hook: post_JSONRouterReload
   available props db, routers, app, router, server
```

#### Example

```js
// @ts-check
const WebSocket = require('ws')

/** @type {import('@mmis1000/json-server-split').Hooks} */
const hooks = {}

hooks.post_ServerStart = ({ server }) => {
  const wss = new WebSocket.Server({ noServer: true })

  wss.on('connection', function connection(ws, req) {
  })

  server.on('upgrade', function upgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request)
    })
  })
}
```

## Programmed usage

The response rewriter can be used as a standalone function or a `JSON Server` `render` function.
This library exports both.

### As a `JSON Server` `render` function

```ts
declare const router: JSONServerRouter

import { createRender } from '@mmis1000/json-server-split'

const render = createRender(
  {
    "/assets/*": ["thumbs.url", "images.*"]
  },
  argv["assets-url-base"],
  argv["assets-url-header"]
)

router.render = render
```

### As a util function

```js
import { fixAssetsPath } from '@mmis1000/json-server-split'

const original = {
  "url": "a.png",
  "a": "b.png"
}

const new = fixAssetsPath(
  original,
  // the new base
  "http://example.com/",
  // fields need to be rewritten
  ["url"]
)

/*
 * {
 *  "url": "http://example.com/a.png",
 *  "a": "b.png"
 * }
 */
```

## Caveats

### Watch on js works partially

Watch against javascript files only works properly when the file itself changed because there is no way to know what file the module tries to require.  
Change in file outside of the directory and included indirectly by watched file still need a full restart to take effect.
