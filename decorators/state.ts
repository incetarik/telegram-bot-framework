import { SYM_EVENTS, SYM_STATE } from './common'

const SYM_INITIAL_TIMEOUT = Symbol('@@bot-prop-initial-timeout')

function installTimeout(this: any, propName: string, prop: IBotStateSettings, propDefault?: any) {
  //@ts-ignore
  if (!prop[ SYM_INITIAL_TIMEOUT ]) { return }
  const state = this[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
  prop.timeout = setTimeout(() => {
    const p = state[ propName ]
    //@ts-ignore
    if (p.props[ '_reset' ]?.()) {
      //@ts-ignore
      p.value = prop.defaultWhenTimeouts || prop.defaultsTo || prop[ '_propDefault' ] || propDefault
    }

    if (prop.emitsEvent) {
      this[ SYM_EVENTS ].next({
        name: 'prop.timeout',
        data: propName,
        type: 'i'
      })
    }

  //@ts-ignore
  }, prop[ SYM_INITIAL_TIMEOUT ]) as any

  if (prop.emitsEvent) {
    this[ SYM_EVENTS ].next({
      name: 'prop.timerreset',
      data: propName,
      type: 'i'
    })
  }
}

/**
 * Marks a property as client/user state variable.
 * Hence, the decorated property may not be the same for all users.
 *
 * By using normal access (`this.prop`), the user will get only its changes
 * last state, done on the property.
 *
 * @export
 * @param {IBotStateSettings} [properties] The properties of the decorator.
 * @returns A property decorator.
 */
export function state(properties?: IBotStateSettings) {
  return function (target: any, propName: string, _descriptor?: any) {
    let propDefault: any = undefined
    let originalSettings: any = {}

    if (!properties) {
      properties = {}
    }

    //@ts-ignore
    properties[ SYM_INITIAL_TIMEOUT ] = properties.timeout
    //@ts-ignore
    properties[ '_timerSet' ] = false

    if (!('emitEvents' in properties)) {
      properties.emitsEvent = true
    }

    originalSettings = { ...properties }

    //@ts-ignore
    properties[ '_reset' ] = function () {
      Object.assign(this, originalSettings)

      if (this.resetOnce) {
        //@ts-ignore
        this[ '_reset' ] = () => false
      }

      return true
    }

    const stateProperties = properties as typeof properties & { _reset(): boolean, _propDefault: any, _timerSet: boolean, [ SYM_INITIAL_TIMEOUT ]: number }

    Object.defineProperty(target, propName, {
      get(this: any) {
        const state = this[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
        if (!state) { return propDefault }

        if (!(propName in state)) {
          state[ propName ] = {
            value: propDefault,
            props: stateProperties
          }

          return propDefault
        }

        const info = state[ propName ]
        const { value, props: _prevStateProps } = info
        const prevStateProps = _prevStateProps as typeof stateProperties

        const { emitsEvent = true, readingResetsTimer = false, usageCount } = prevStateProps
        const initialTimeout = prevStateProps[ SYM_INITIAL_TIMEOUT ]

        if (typeof usageCount === 'number') {
          if (!--prevStateProps.usageCount!) {
            if (prevStateProps._reset?.()) {
              state[ propName ].value = prevStateProps.defaultWhenExpires ?? prevStateProps.defaultsTo ?? propDefault
            }

            if (emitsEvent) {
              this[ SYM_EVENTS ].next({
                name: `prop.expired`,
                data: propName,
                type: 'i'
              })
            }
          }
        }

        if (readingResetsTimer) {
          if (typeof prevStateProps.timeout === 'number') {
            clearTimeout(prevStateProps.timeout as any)
            installTimeout.call(this, propName, prevStateProps, propDefault)
          }
        }

        if (typeof initialTimeout === 'number' && initialTimeout > 0) {
          if ('_timerSet' in prevStateProps && !prevStateProps._timerSet) {
            installTimeout.call(this, propName, prevStateProps, propDefault)
            delete prevStateProps[ '_timerSet' ]
          }
        }

        return value
      },
      set(this: any, value: any) {
        const state = this[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
        if (!state) {
          propDefault = value
          stateProperties._propDefault = value
          return
        }

        if (!(propName in state)) {
          state[ propName ] = {
            value,
            props: stateProperties
          }

          return
        }

        const prop = state[ propName ]
        prop.value = value

        const { props: _prevStateProps } = prop
        const prevStateProps = _prevStateProps as typeof stateProperties

        if (!prevStateProps) {
          prop.props = stateProperties
          return
        }

        const { writingResetsTimer = false, timeout } = prevStateProps
        const initialTimeout = prevStateProps[ SYM_INITIAL_TIMEOUT ]

        if (writingResetsTimer) {
          if (typeof timeout === 'number') {
            clearTimeout(timeout as any)
            installTimeout.call(this, propName, prevStateProps, propDefault)
          }
        }

        if (typeof initialTimeout === 'number' && initialTimeout > 0) {
          if ('_timerSet' in prevStateProps && !prevStateProps._timerSet) {
            installTimeout.call(this, propName, prevStateProps, propDefault)
            delete prevStateProps[ '_timerSet' ]
          }
        }
      }
    })
  }
}
