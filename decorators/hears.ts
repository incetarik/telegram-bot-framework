import { INIT_MAP } from './common'

const DEFAULTS: Partial<IHearsDecoratorOpts> = {
  emitsEvent: false,
  executeCount: Infinity,
  keepMatchResults: false
}

export function hears(opts: IHearsDecoratorOpts | string) {
  return function <T extends (...args: any[]) => any = (...args: any[]) => any>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    if (typeof opts === 'string') {
      opts = {
        ...DEFAULTS,
        match: new RegExp(opts),
      }
    }

    if (opts instanceof RegExp) {
      opts = {
        ...DEFAULTS,
        match: opts,
      }
    }
    else if (typeof opts.match !== 'string' && !(opts.match instanceof RegExp)) {
      throw new Error('@hears() should have string | RegExp match')
    }

    if (typeof opts.match === 'string') {
      let { match } = opts
      match = match.replace(/\^/g, '\\^').replace(/\$/g, '\\$')

      if (!match.startsWith('^')) {
        match = `^${match}`
      }

      if (!match.endsWith('$')) {
        match = `${match}$`
      }

      opts.match = new RegExp(match)
    }

    opts = {
      ...DEFAULTS,
      ...opts
    }

    const originalFunction = target[ propName ]

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({
      type: 'hears',
      handler: originalFunction,
      match: opts.match as RegExp,
      name: propName,
      opts,
    })

    return descriptor
  }
}
