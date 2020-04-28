import { INIT_MAP } from './common'

const DEFAULTS: Partial<ICommandDecoratorOpts> = {
  emitsEvent: false,
  resetStates: [],
}

export function command(opts?: ICommandDecoratorOpts) {
  return function <T extends (...args: any[]) => any = (...args: any[]) => any>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    if (typeof opts !== 'object') {
      opts = {
        name: propName,
        ...DEFAULTS
      }
    }
    else {
      opts = {
        name: propName,
        ...DEFAULTS,
        ...opts
      }
    }

    const originalFunction = target[ propName ]

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({
      name: opts.name || propName,
      type: 'command',
      handler: originalFunction,
      opts
    })

    return descriptor
  }
}
