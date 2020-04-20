import { IncomingMessage } from 'telegraf/typings/telegram-types'
import { SYM_PROMISE_REPLACE } from '../decorators/common'

const waitingStates: {
  [ key: number ]: {
    resolve: (value: any) => void,
    reject: (error: string | Error) => void
  }
} = {}

const resolveConditions: {
  [ key: number ]: {
    condition(message: IncomingMessage): boolean,
    shouldRejectInsteadOfWaiting: boolean
  }
} = { }

class WaitingStateHandler {
  private _willUnlockWaitForUserForOnce = false

  private cancelWaiting(id?: number): boolean {
    if (typeof id !== 'number') { return false }
    return delete waitingStates[ id ]
  }

  /**
   * Resolves previous waiting promise with cancel signal
   * (`SYM_PROMISE_REPLACE`) if present and replaces with the given one, so
   * this is essentially equal to `waitForUser` function with addition to
   * resolving previous with special return.
   *
   * **Note**: If this is being used in code, ensure that wherever it is
   * awaited, it should be tested whether the returned value is cancelled
   * or not, to do so, use function
   *
   * ```js
   * IBot.isCancelled(value)
   * ```
   * function.
   *
   * @param {number} id ID of the user.
   * @param {boolean} [append=false] Indicates whether the new promise should
   * be appended to previous ones. _Reserved for future usage._
   *
   * @param {number} [timeout=0] Timeout for the message, if time outs, then
   * the wait will be resulted in rejection.
   *
   * @returns {Promise<IncomingMessage>} Promise that is resolved when user
   * replies.
   * emberof WaitingStateHandler
   */
  cancelAndReplace(id: number, append?: boolean, timeout?: number): Promise<IncomingMessage> {
    if (id in waitingStates) {
      waitingStates[ id ].resolve(SYM_PROMISE_REPLACE)
      delete waitingStates[ id ]
    }

    return this.waitForUser( id, append, timeout )
  }

  /**
   * Waits for user and returns a promise which will be resolved or rejected
   * manually when user replies to the bot.
   *
   * @param {number} id ID of the user.
   * @param {boolean} [append=false] Indicates whether the new promise should
   * be appended to previous ones. _Reserved for future usage._
   *
   * @param {number} [timeout=0] Timeout for the message, if time outs, then
   * the wait will be resulted in rejection.
   *
   * @returns {Promise<IncomingMessage>} Promise that is resolved when user
   * replies.
   *
   * @memberof WaitingStateHandler
   */
  waitForUser(id: number, append: boolean = false, timeout: number = 0): Promise<IncomingMessage> {
    if (this._willUnlockWaitForUserForOnce) {
      if (id in waitingStates) {
        return Promise.reject(new Error('The user is already waited'))
      }
    }

    this._willUnlockWaitForUserForOnce = false

    return new Promise<IncomingMessage>((resolve, reject) => {
      if (id in waitingStates) {
        if (append) {
          const state = waitingStates[ id ]
          const { reject: oldReject, resolve: oldResolve } = state

          state.reject = (e) => {
            oldReject(e)
            reject(e)
            return e
          }

          state.resolve = (val) => {
            oldResolve(val)
            resolve(val)
            return val
          }
        }
        else {
          return Promise.reject(new Error('The user is already waited'))
        }
      }
      else {
        waitingStates[ id ] = { resolve, reject }

        if (timeout) {
          setTimeout(() => {
            this.rejectFor(id, new Error('Timeout'))
          }, timeout);
        }
      }
    })
  }

  /**
   * Adds a condition before resolving the message. In this way, the message
   * will be resolved or rejected according to the given predicate.
   *
   * **Note**: This function has no effect if the user is already waiting for
   * certain message for ever (`waitUntil` function is used). Likewise, if
   * the user is already being waited by `waitForUser` function, then this
   * function has no effect.
   *
   * It is possible to add several conditions together and if one fails, all
   * will fail and reject the condition.
   *
   * @param {number} id ID of the user.
   * @param {(message: IncomingMessage) => boolean} condition The condition.
   * @returns Promise to await, if there is an error, the promise will simply
   * reject with an explanation.
   *
   * @memberof WaitingStateHandler
   */
  resolveIf(id: number, condition: (message: IncomingMessage) => boolean) {
    if (id in resolveConditions) {
      const conditionObj = resolveConditions[ id ]
      if (!conditionObj.shouldRejectInsteadOfWaiting) {
        return Promise.reject(new Error('The user is already being waited'))
      }

      const previousCondition = conditionObj.condition
      conditionObj.condition = (message) => {
        if (!previousCondition(message)) {
          return false
        }

        return condition(message)
      }

      if (id in waitingStates) { return waitingStates[ id ] }
      else {
        this._willUnlockWaitForUserForOnce = true
        return this.waitForUser(id)
      }
    }
    else {
      resolveConditions[ id ] = {
        condition,
        shouldRejectInsteadOfWaiting: true
      }

      this._willUnlockWaitForUserForOnce = true
      return this.waitForUser(id)
    }
  }

  /**
   * Adds a condition befo{  r }olving the message. In this way, the message
   * will be resolved only when the given condition is met. So user may send
   * many messages to the bot and bot may just ignore them until the message
   * condition is met and then the rest of the procedures will apply.
   *
   * **Note**: This function has no effect if the bot has already conditions
   * set for the user input (`resolveIf` function is used). Likewise if the
   * user is already being waited by `waitForUser` function, then this
   * function has no effect.
   *
   * It is not possible to add several conditions together so that it could
   * be preferable merging all the possible check functions into one and
   * setting it as the waiting condition.
   *
   * @param {number} id ID of the user.
   * @param {(message: IncomingMessage) => boolean} condition The condition.
   * @returns Promise to await, if there is an error, the promise will
   * simply reject with an explanation.
   *
   * @memberof WaitingStateHandler
   */
  waitUntil(id: number, condition: (message: IncomingMessage) => boolean) {
    if (id in waitingStates) {
      return Promise.reject(new Error('The user is already being waited'))
    }

    if (id in resolveConditions) {
      return Promise.reject(new Error('The user is already being waited'))
    }

    resolveConditions[ id ] = {
      condition,
      shouldRejectInsteadOfWaiting: false
    }

    this._willUnlockWaitForUserForOnce = true
    return this.waitForUser(id)
  }

  /**
   * Resolves previously waited user{ es }ge with an error.
   *
   * @param {number} id ID of the user to resolve with a message.
   * @param {IncomingMessage} value The value to resolve with.
   * @returns `true` if successfully resolved.
   * @memberof WaitingStateHandler
   */
  resolveFor(id: number, value: IncomingMessage) {
    if (!(id in waitingStates)) { return false }

    if (id in resolveConditions) {
      const conditionObj = resolveConditions[ id ]
      if (!conditionObj.condition(value)) {
        if (conditionObj.shouldRejectInsteadOfWaiting) {
          this.rejectFor(id, new Error('Condition is not met'))
        }

        return false
      }
    }

    waitingStates[ id ].resolve(value)
    delete waitingStates[ id ]
    delete resolveConditions[ id ]
    return true
  }

  /**
   * Rejects previously waited user message with an error.
   *
   * @param {number} id ID of the user to reject with a message.
   * @param {(string | Error)} err The error description.
   * @returns `true` if successfully rejected.
   * @memberof WaitingStateHandler
   */
  rejectFor(id: number, err: string | Error) {
    if (id in waitingStates) {
      waitingStates[ id ].reject(err)
      delete resolveConditions[ id ]
      delete waitingStates[ id ]
      return true
    }

    return false
  }
}

export const WaitingStates = new WaitingStateHandler()
