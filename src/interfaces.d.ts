interface Argv {
  _: string[]

  snapshots: string
  port: number
  host: string
  id: string;

  watch?: boolean
  quiet?: boolean;
  readOnly?: boolean;
  noCors?: boolean;
  noGzip?: boolean;
  static?: string;
  delay?: number;
  foreignKeySuffix?: string
  routes?: string
  middlewares?: string[]
}
