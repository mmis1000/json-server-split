const child_process = require('child_process')
const path = require('path')
const fs = require('fs')
const fetch = require('node-fetch').default

const { fixAssetsPath } = require('../lib')

const port = 3500 + Math.floor(Math.random() * 100)

function copyFolderSync(from, to) {
  fs.mkdirSync(to);
  fs.readdirSync(from).forEach(element => {
      if (fs.lstatSync(path.join(from, element)).isFile()) {
          fs.copyFileSync(path.join(from, element), path.join(to, element));
      } else {
          copyFolderSync(path.join(from, element), path.join(to, element));
      }
  });
}

describe('test remap', () => {
  it ('should remap paths to absolute path', () => {
    const original = {
      "url": "a.png",
      "a": "b.png"
    }

    const newRes = fixAssetsPath(
      original,
      // the new base
      "http://example.com/",
      // fields need to be rewritten
      ["url"]
    )

    expect(newRes).toEqual({
      "url": "http://example.com/a.png",
      "a": "b.png"
    })
  })
  it ('should remap paths to absolute path', () => {
    const original = {
      "url": "a.png",
      "a": "b.png"
    }

    const newRes = fixAssetsPath(
      original,
      // the new base
      "/aa/",
      // fields need to be rewritten
      ["url"]
    )

    expect(newRes).toEqual({
      "url": "/aa/a.png",
      "a": "b.png"
    })
  })

  it ('should remap all nested paths to absolute path', () => {
    const original = [
      "a.png",
      "b.png"
    ]

    const newRes = fixAssetsPath(
      original,
      // the new base
      "http://example.com/",
      // fields need to be rewritten
      ["*"]
    )

    expect(newRes).toEqual([
      "http://example.com/a.png",
      "http://example.com/b.png"
    ])
  })

  it ('should not remap paths when depth does not match', () => {
    const original = {
      "url": {
        "a": "a.png"
      },
      "a": "b.png"
    }

    const newRes = fixAssetsPath(
      original,
      // the new base
      "http://example.com/",
      // fields need to be rewritten
      ["*"]
    )

    expect(newRes).toEqual({
      "url": {
        "a": "a.png"
      },
      "a": "http://example.com/b.png"
    })
  })
})
describe('test server 1', () => {
  /**
   * @type { import('child_process').ChildProcess }
  */
  let subProcess

  beforeEach(() => {
    subProcess = child_process.fork(
      path.resolve(__dirname, '../lib/cli/bin.js'),
      [
        '--config', path.resolve(__dirname, './fixture/json-server.json'),
        '--port', port,
        '--quiet',
        path.resolve(__dirname, './fixture/db')
      ],
      {}
    )
    return new Promise(resolve => {
      subProcess.on('message', m => {
        if (m.type === 'ready') {
          resolve()
        }
      })
    })
  })

  afterEach(() => {
    return new Promise(resolve => {
      subProcess.once('exit', resolve)
      subProcess.kill('SIGINT')
    })
  })

  it ('should return a valid response', async () => {
    const res = await (await fetch(`http://localhost:${port}/resources`)).json()
    expect(res).toEqual({
      "readme": `http://localhost:${port}/assets/test.txt`,
      "thumb": `http://localhost:${port}/a.png`,
      "title": "test"
    })
  })

  it ('should return a valid response for ts file', async () => {
    const res = await (await fetch(`http://localhost:${port}/test4`)).json()
    expect(res).toEqual({
      "seed": "tests4"
    })
  })

  it ('should have registered custom routes', async () => {
    const res = await (await fetch(`http://localhost:${port}/now`)).json()
    expect(typeof res.time).toEqual('string')
    expect(typeof res.random).toEqual('number')
  })

  it ('should have registered custom routes with __esModule flag', async () => {
    const res = await (await fetch(`http://localhost:${port}/now2`)).json()
    expect(typeof res.time).toEqual('string')
    expect(typeof res.random).toEqual('number')
  })


  it ('should alias custom routes', async () => {
    const res = await (await fetch(`http://localhost:${port}/time`)).json()
    expect(typeof res.time).toEqual('string')
    expect(typeof res.random).toEqual('number')
  })

  it ('should have middleware applied properly', async () => {
    const headers = (await fetch(`http://localhost:${port}/now`)).headers
    expect(headers.get('X-Powered-By')).toEqual('Potato')
  })
})
describe('test server 2', () => {
  /**
   * @type { import('child_process').ChildProcess }
  */
  let subProcess

  beforeEach(() => {
    subProcess = child_process.fork(
      path.resolve(__dirname, '../lib/cli/bin.js'),
      [
        '--config', path.resolve(__dirname, './fixture/json-server2.json'),
        '--port', port,
        '--quiet',
        path.resolve(__dirname, './fixture/db')
      ],
      {}
    )
    return new Promise(resolve => {
      subProcess.on('message', m => {
        if (m.type === 'ready') {
          resolve()
        }
      })
    })
  })

  afterEach(() => {
    return new Promise(resolve => {
      subProcess.once('exit', resolve)
      subProcess.kill('SIGINT')
    })
  })

  it ('should have middleware in dir applied properly', async () => {
    const headers = (await fetch(`http://localhost:${port}/now`)).headers
    expect(headers.get('X-Ts-By')).toEqual('TsNode')
    expect(headers.get('X-Potato-Baked-By')).toEqual('Intel')
    expect(headers.get('X-Cookie-Baked-By')).toEqual('Grandma')
  })

  it ('should have middleware in dir with __esModule flag applied properly', async () => {
    const headers = (await fetch(`http://localhost:${port}/now`)).headers
    expect(headers.get('X-Imports-As')).toEqual('EsModule')
  })
})


describe('test reload', () => {
  /**
   * @type { import('child_process').ChildProcess }
  */
  let subProcess

  beforeEach(() => {
    copyFolderSync(
      path.resolve(__dirname, './fixture'),
      path.resolve(__dirname, './tmp')
    )

    subProcess = child_process.fork(
      path.resolve(__dirname, '../lib/cli/bin.js'),
      [
        '--config', path.resolve(__dirname, './tmp/json-server.json'),
        '--port', port,
        '--quiet',
        path.resolve(__dirname, './tmp/db')
      ],
      {}
    )

    return new Promise(resolve => {
      subProcess.on('message', m => {
        if (m.type === 'ready') {
          resolve()
        }
      })
    })
  })

  afterEach(async () => {
    await new Promise(resolve => {
      subProcess.once('exit', resolve)
      subProcess.kill('SIGINT')
    })

    fs.rmSync(path.resolve(__dirname, './tmp'), { recursive: true })
  })

  it ('should change middleware on the fly', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/middlewares/server-type.js'),
      `
        // hello.js 
        module.exports = (req, res, next) => {
          res.header('X-Powered-By', 'Tomato')
          next()
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const headers = (await fetch(`http://localhost:${port}/now`)).headers
    expect(headers.get('X-Powered-By')).toEqual('Tomato')
  })

  it ('should change routers on the fly', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routers/now.js'),
      `
        module.exports = function (req, res) {
          res.jsonp({
            time: new Date().toISOString(),
            random: Math.random(),
            newProp: 'AAA'
          })
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const res = await (await fetch(`http://localhost:${port}/now`)).json()
    expect(res.newProp).toEqual('AAA')
  })
  it ('should handle corrupted middleware nicely', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/middlewares/server-type.js'),
      `
        this is fucked up
      `
    )

    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/middlewares/server-type.js'),
      `
        // hello.js 
        module.exports = (req, res, next) => {
          res.header('X-Powered-By', 'Tomato')
          next()
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const headers = (await fetch(`http://localhost:${port}/now`)).headers
    expect(headers.get('X-Powered-By')).toEqual('Tomato')
  })


  it ('should handle corrupted routers nicely', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routers/now.js'),
      `
        this contains an error
      `
    )

    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routers/now.js'),
      `
        module.exports = function (req, res) {
          res.jsonp({
            time: new Date().toISOString(),
            random: Math.random(),
            newProp: 'AAA'
          })
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const res = await (await fetch(`http://localhost:${port}/now`)).json()
    expect(res.newProp).toEqual('AAA')
  })

  it ('should modified db ts on the fly', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/db/test.ts'),
      `
        export = {
          "seed": "modified-tests4"
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const res = await (await fetch(`http://localhost:${port}/test`)).json()
    expect(res).toEqual({
      "seed": "modified-tests4"
    })
  })

  it ('should change routes on the fly', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routes.json'),
      `
      {
        "/test4/files/:K": "/resources",
        "/time1": "/now"
      }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const res = await (await fetch(`http://localhost:${port}/time1`)).json()
    expect(typeof res.time).toEqual('string')
  })

  it ('should change assets url map on the fly', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/assetsPaths.json'),
      `
        {
          "/resources": ["readme", "thumb", "title"]
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))
    const res = await (await fetch(`http://localhost:${port}/resources`)).json()
    expect(res).toEqual({
      "readme": `http://localhost:${port}/assets/test.txt`,
      "thumb": `http://localhost:${port}/a.png`,
      "title": `http://localhost:${port}/test`
    })
  })

  it ('assets url works after server reload', async () => {
    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routers/now.js'),
      `
        this contains an error
      `
    )

    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/routers/now.js'),
      `
        module.exports = function (req, res) {
          res.jsonp({
            time: new Date().toISOString(),
            random: Math.random(),
            newProp: 'AAA'
          })
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))
    const res = await (await fetch(`http://localhost:${port}/resources`)).json()
    expect(res).toEqual({
      "readme": `http://localhost:${port}/assets/test.txt`,
      "thumb": `http://localhost:${port}/a.png`,
      "title": `test`
    })
  })

  it ('should add new db resource on the fly', async () => {
    const payload = Math.random()

    await new Promise(r => setTimeout(r, 500))

    fs.writeFileSync(
      path.resolve(__dirname, './tmp/db/new.json'),
      `
        {
          "secret": ${payload}
        }
      `
    )

    await new Promise(r => setTimeout(r, 500))

    const res = await (await fetch(`http://localhost:${port}/new`)).json()
    expect(res.secret).toEqual(payload)
  })
})

describe('test definition generation', () => {
  /**
   * @type { import('child_process').ChildProcess }
  */
  let subProcess

  beforeEach(() => {
    copyFolderSync(
      path.resolve(__dirname, './fixture'),
      path.resolve(__dirname, './tmp')
    )

    subProcess = child_process.fork(
      path.resolve(__dirname, '../lib/cli/bin.js'),
      [
        '--config', path.resolve(__dirname, './tmp/json-server4.json'),
        '--port', port,
        '--quiet',
        path.resolve(__dirname, './tmp/db')
      ],
      {}
    )

    return new Promise(resolve => {
      subProcess.on('message', m => {
        if (m.type === 'ready') {
          resolve()
        }
      })
    })
  })

  afterEach(async () => {
    await new Promise(resolve => {
      subProcess.once('exit', resolve)
      subProcess.kill('SIGINT')
    })

    fs.rmSync(path.resolve(__dirname, './tmp'), { recursive: true })
  })

  it ('should generate definition properly', async () => {
    const data = fs.readFileSync(
      path.resolve(__dirname, './tmp/definition.ts'),
      { encoding: 'utf8' }
    )

    expect(data).toMatchSnapshot()
  })
})