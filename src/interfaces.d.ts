interface Argv {
  _: (number|string)[]

  'assets-url-map'?: string
  'assets-url-base'?: string
  'routers'?: string

  snapshots: string
  port: number
  host: string
  id: string;

  watch?: boolean
  quiet?: boolean;
  readOnly?: boolean;
  noCors?: boolean;
  noGzip?: boolean;
  static?: string | undefined;
  delay?: number;
  foreignKeySuffix?: string
  routes?: string
  middlewares?: string[]
}
