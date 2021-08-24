
const green = require('chalk').green;

/** @type {(name: string) => import('../../../src/interfaces').Hook} */
const hook = (str) => (ctx) => {
  console.log('-- Running ' + green(str))
  console.log('   available props ' + Object.keys(ctx).join(', '))
}

/** @type {import('../../../src/interfaces').Hooks} */
const hooks = {}

hooks.pre_Default = hook('pre_Default');
hooks.pre_Delay = hook('pre_Delay');
hooks.pre_JSONRouter = hook('pre_JSONRouter');
hooks.pre_Middlewares = hook('pre_Middlewares');
hooks.pre_Route = hook('pre_Route');
hooks.pre_Routers = hook('pre_Routers');
hooks.pre_ServerStart = hook('pre_ServerStart');


hooks.post_Default = hook('post_Default');
hooks.post_Delay = hook('post_Delay');
hooks.post_JSONRouter = hook('post_JSONRouter');
hooks.post_Middlewares = hook('post_Middlewares');
hooks.post_Route = hook('post_Route');
hooks.post_Routers = hook('post_Routers');
hooks.post_ServerStart = hook('post_ServerStart');

Object.assign(exports, hooks)