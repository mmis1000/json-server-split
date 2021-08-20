# JSON Server Split

This project extends [JSON Server](https://github.com/typicode/json-server)
to make it suit for large project better.

Most apis in `JSON Server` are keeps as is.

The extension aims to allow users mock most of back-ends pattern with use the JSON server as a library and handle everything yourself.

## Table of contents

- Extensions
  - [The db file structure](#the-db-file-structure)
  - [Programmed generation of certain db fields](#programmed-generation-of-certain-db-fields)
  - [Saved snapshot of generated data](#saved-snapshot-of-generated-data)
  - [Immutable record](#immutable-record)
  - [Volatile record](#volatile-record)
  - [Custom routes](#custom-routes)
  - [Rewrite response to make url work](#rewrite-response-to-make-url-work)
  - [Path in `--config` option now relatives to config file](#path-in-config-option-now-relatives-to-config-file)
  - [Watch works with middleware and anything need to be watched](#watch-works-with-middleware-and-anything-need-to-be-watched)
- Caveats
  - [Watch on js works partially](#watch-on-js-works-partially)

## Extensions

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
  "/assets/*": ["thumbs/url", "images/*"]
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

**(See also Caveats, reload js file still has some limitation)**

All files are watched now.
Include newly added `--routers` , `--assets-url-map`.

You can just enable watch, edit them and they will take care of the rest.

## Programmed usage

The response rewriter can be used as a standalone function or a `JSON Server` `render` function.
This library exports both.

### As a `JSON Server` `render` function

```ts
declare const router: JSONServerRouter

import { createRender } from '@mmis1000/json-server-split'

const render = createRender(
  {
    "/assets/*": ["thumbs/url", "images/*"]
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
Change in file included indirectly still need a full restart to take effect.
