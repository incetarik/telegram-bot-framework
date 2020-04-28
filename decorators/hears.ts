import { INIT_MAP } from './common'

const DEFAULTS: Partial<IHearsDecoratorOpts> = {
  emitsEvent: false,
  executeCount: Infinity,
  keepMatchResults: false
}

/**
 * Marks the function as `hears` function meaning that the function will be
 * executed when the user message matches the given string exactly, or matches
 * to a given regular expression.
 *
 * When the match occurs with RegExp, then the matched groups will be passed as
 * the parameters of the function where the full-match is the last parameter
 * and the parameters starts from the first group.
 *
 * @export
 * @param {(IHearsDecoratorOpts | string)} opts Options or the exact match.
 * @returns Method Decorator
 */
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
