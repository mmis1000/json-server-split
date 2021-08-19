declare module 'connect-pause' {
  declare const pause: (delay: number) => import('express').RequestHandler
  export default pause
}