#!/usr/bin/env node
// require('please-upgrade-node')(require('../../package.json'))
try {
  require('ts-node').register({ transpileOnly: true })
} catch (err) {}
require('./').default()