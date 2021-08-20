interface Argv {
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
}
