import type * as express from 'express'
import jsonServer from 'json-server';
import { pathToRegexp } from 'path-to-regexp';
import { fixAssetsPath } from './assets-path-fixer';
import { BASE_URL_HEADER } from './constants';

export const router = jsonServer.router
export const rewriter = jsonServer.rewriter
export const defaults = jsonServer.defaults
export const create = jsonServer.create
export const createRender = (pathMap: Record<string, string[]>, basePath?: string) => {
  return function render(req: express.Request, res: express.Response) {
    const base = basePath != null
      ? basePath
      : req.get(BASE_URL_HEADER) != null
        ? req.get(BASE_URL_HEADER)!
        : req.protocol + '://' + req.get('host')

    const pathParsed: {
      regex: RegExp,
      rewrite: string[]
    }[] = Object.keys(pathMap).map(key => ({
      regex: pathToRegexp(key, []),
      rewrite: pathMap[key]
    }))

    for (let item of pathParsed) {
      if (item.regex.test(req.url)) {
        res.jsonp(fixAssetsPath(res.locals.data, base, item.rewrite))
        return 
      }
    }

    res.jsonp(res.locals.data)
  }
}