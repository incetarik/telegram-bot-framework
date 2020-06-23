import { ExtraEditMessage } from 'telegraf/typings/telegram-types'
import { IMenu, MenuBuilder } from 'telegram-inline-menu'

export const SYM_DYNAMIC_INLINE_MENU = Symbol('@@dynamic-inline-menu')

/**
 * Creates an object indicating that an inline menu should be shown.
 *
 * @export
 * @param {(IMenu | Func<IMenu | Promise<IMenu>>)} layout The layout of the menu.
 * @returns The object for inline menu message.
 */
export function inlineMenu(layout: IMenu | Func<IMenu | Promise<IMenu>, any>) {
  if (typeof layout === 'function') {
    const _layout = layout
    function prepareInlineMenu(resolver: (resolveWith: any) => void) {
      return _layout(resolver)
    }

    Object.defineProperty(prepareInlineMenu, SYM_DYNAMIC_INLINE_MENU, {
      configurable: false,
      enumerable: false,
      value: true
    })

    return { inlineMenu: prepareInlineMenu }
  }

  return {
    inlineMenu: layout
  }
}

/**
 * Indicates whether an object is an inline menu indicator or not.
 *
 * @export
 * @param {*} object Object to check.
 * @returns {IInlineMenuInfo} `true`
 * if the object is inline menu indicator object.
 */
export function isInlineMenu(object: any): object is IInlineMenuInfo {
  if (typeof object !== 'object') { return false }
  if (typeof object.inlineMenu === 'object') { return true }
  if (typeof object.inlineMenu === 'function') { return true }
  return false
}

export interface IInlineMenuInfo {
  inlineMenu: IMenu | Promise<IMenu> | MenuBuilder | ((resolve: (resolveWith: any) => void, reject: (e: Error) => void) => IMenu | Promise<IMenu>)
  closeOnTimeout?: boolean
  timeoutMessage?: string
  onSelected?: Function
  extra?: ExtraEditMessage
}
