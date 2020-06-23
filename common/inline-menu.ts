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
 * @type {T} The type of the inline menu items.
 * @param {*} object Object to check.
 * @returns {IInlineMenuInfo} `true`
 * if the object is inline menu indicator object.
 */
export function isInlineMenu<T = any>(object: any): object is IInlineMenuInfo<T> {
  if (typeof object !== 'object') { return false }
  if (typeof object.inlineMenu === 'object') { return true }
  if (typeof object.inlineMenu === 'function') { return true }
  return false
}

export interface IInlineMenuInfo<T = any> {
  /**
   * The inline menu or the builder of it.
   *
   * @memberof IInlineMenuInfo
   */
  inlineMenu: IMenu | Promise<IMenu> | MenuBuilder | ((resolve: (resolveWith: any) => void, reject: (e: Error) => void) => IMenu | Promise<IMenu>)

  /**
   * Indicates whether the menu should be closed on timeout or not.
   *
   * @type {boolean}
   * @memberof IInlineOptionsInformation
   */
  closeOnTimeout?: boolean

  /**
   * The message to be sent when timeout occurs.
   *
   * @type {string}
   * @memberof IInlineOptionsInformation
   */
  timeoutMessage?: string

  /**
  * A function to be executed when an item is selected.
  *
  * Setting this will make the generator NON-BLOCKING.
  *
  * @type {Function}
  * @memberof IInlineOptionsInformation
  */
  onSelected?(item: T): {
    message ?: string;
  } | void | undefined;

  /**
  * The extras of the template message.
  *
  * @type {ExtraEditMessage}
  * @memberof IInlineOptionsInformation
  */
  extra?: ExtraEditMessage
}
