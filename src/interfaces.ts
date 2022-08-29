export interface Argv {
  config?: string

  _: (number|string)[]

  'assets-url-map'?: string
  assetsUrlMap?: string

  'assets-url-base'?: string
  assetsUrlBase?: string

  'assets-url-header': string
  // assetsUrlHeader: string

  'routers'?: string

  snapshots: string
  port: number
  host: string
  id: string;

  watch?: boolean
  quiet?: boolean;

  'read-only'?: boolean;
  readOnly?: boolean;

  'no-cors'?: boolean;
  noCors?: boolean;

  'no-gzip'?: boolean;
  noGzip?: boolean;

  static?: string | undefined;
  delay?: number;
  foreignKeySuffix?: string
  routes?: string
  middlewares?: string[]
  hooks?: string[]

  generatesTsDefinition?: string
  'generates-ts-definition'?: string
}

type HookMapper<Types extends string> = `pre_${Types}` |  `post_${Types}`

export type HookTypes = HookMapper<import('./constants').HookNames>

export interface RouteInfo {
  route: string
  relativePath: string
  handler: import('express').RequestHandler
}

export type HookContext = {
  db: import('lowdb').LowdbSync<any>

  routers?: RouteInfo[]
  app?: import('express').Application
  router?: import('json-server').JsonServerRouter<any>
  server?: import('http').Server
}

export type Hook = (ctx: HookContext) => void

export type Hooks = {
  [K in HookTypes]?: Hook
}