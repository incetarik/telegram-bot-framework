import { existsSync, readFile } from 'fs'
import { compile as compileTemplate } from 'handlebars'
import { join } from 'path'
import { ContextMessageUpdate, Extra, Markup } from 'telegraf'
import {
  ExtraEditMessage, ExtraPhoto, IncomingMessage, InputFile, Message,
  MessageMedia, MessagePhoto, User
} from 'telegraf/typings/telegram-types'
import { CBHandler, IMenu, inlineMenu } from 'telegram-inline-menu'

import { IBotSettings } from '../create-bot'
import { IBot } from '../decorators'
import {
  ActionInfo, CommandInfo, HearsInfo, InitInfo, isGenerator, isPromise,
  MenuInfo, SYM_CBHANDLER_FUNCTION, SYM_CONTEXT, SYM_EVENTS,
  SYM_HEAR_EXEC_COUNTS, SYM_ONCE, SYM_PROMISE_REPLACE, SYM_STATE
} from '../decorators/common'
import { _ } from '../translations'
import { isInlineMenu } from './inline-menu'
import { IInputOpts, isInputOptions } from './input-opts'
import { INotificationInfo, isNotificationInfo } from './notify-users'
import {
  IReplyMessage, isImageReplyMessage, isSetActionMessage
} from './reply-message'
import { WaitingStates } from './waiting-states'

type IIteratorOpts = {
  timeout?: number,
  timeoutMessage?: string,
  name?: string
  type?: 'action' | 'command' | 'hears',
  parameters?: any[]
}

class Executer {
  private askedInputInCommand: WeakMap<IBot, boolean> = new WeakMap()
  private executingCommand: WeakMap<IBot, { genOrPromise: AsyncGenerator | Promise<any>, initializer: CommandInfo }> = new WeakMap()
  private executingHear: WeakMap<IBot, HearsInfo & { generator?: AsyncGenerator }> = new WeakMap()
  private onceExecutions: WeakMap<IBot, Dictionary<number | boolean>> = new WeakMap()
  private botSettings!: IBotSettings
  private lastMessageSent?: Message

  async fireGeneric(instance: IBot, ctx: ContextMessageUpdate, initializer: InitInfo) {
    const genOrPromise = initializer.handler.call(instance, ctx)

    if (isGenerator(genOrPromise)) {
      return await this.iterate(instance, ctx, genOrPromise)
    }
    else if (isPromise(genOrPromise)) {
      return await genOrPromise
    }
    else {
      return genOrPromise
    }
  }

  async fireOnCommand(instance: IBot, ctx: ContextMessageUpdate, initializer: CommandInfo) {
    if (!(await this.canFire(instance, ctx, initializer))) {
      return
    }

    const {
      onlyFor,
      unauthorizedExecHandlerName = 'onUnauthorizedCommand'
    } = (initializer as any).opts

    if (onlyFor) {
      let { username = '', id } = ctx.from!
      if (username.startsWith('@')) {
        username = username.slice(1)
      }

      let isUnauthorized = false
      if (typeof onlyFor === 'string' && username !== onlyFor) {
        isUnauthorized = true
      }
      else if (typeof onlyFor === 'number' && id !== onlyFor) {
        isUnauthorized = true
      }
      else if (typeof onlyFor === 'function') {
        const result = await onlyFor(id, username)
        isUnauthorized = !result
      }
      else if (Array.isArray(onlyFor)) {
        let matched = false
        for (const cond of onlyFor) {
          if (typeof cond === 'string' && cond === username) {
            matched = true
            break
          }
          else if (typeof cond === 'number' && cond === id) {
            matched = true
            break
          }
        }

        isUnauthorized = !matched
      }

      if (isUnauthorized) {
        //@ts-ignore
        const handler = instance[ unauthorizedExecHandlerName ] as Func | undefined

        if (handler) {
          await this.iterate(instance, ctx, handler, {
            parameters: [ initializer.name, id, username, ctx ],
            name: initializer.name,
            type: initializer.type as any
          })
        }

        return
      }
    }

    if (this.askedInputInCommand.get(instance)) {
      return
    }

    //@ts-ignore
    const { handler, opts } = initializer

    const {
      emitsEvent,
      resetStates,
      timeout,
      timeoutMessage = 'Timed out',
      name
    } = opts as any

    const previousCommand = this.executingCommand.get(instance)
    if (previousCommand) {
      if (emitsEvent) {
        this.emit(instance, 'command.cancel', 'i', name)
      }

      WaitingStates[ 'cancelWaiting' ](ctx.from?.id)
    }

    //@ts-ignore
    const state = instance[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
    for (let i = 0, limit = resetStates!.length; i < limit; ++i) {
      const rs = resetStates![ i ]
      if (typeof rs === 'string') {
        if (!(rs in state)) { continue }

        //@ts-ignore
        state[ rs ].value = state[ rs ].props._propDefault

        //@ts-ignore
        state[ rs ].props[ '_reset' ]?.()
      }
      else if (Array.isArray(rs)) {
        const [ key, defaultValue ] = rs
        if (!(key in state)) { continue }

        //@ts-ignore
        state[ key ].props[ '_reset' ]?.()
        state[ key ].value = defaultValue
      }
    }

    const genOrPromise: any = handler.call(instance)
    if (emitsEvent) {
      this.emit(instance, 'command.call', 'i', name)
    }

    if (isPromise(genOrPromise)) {
      return await genOrPromise
    }

    if (!isGenerator(genOrPromise)) {
      return genOrPromise
    }

    this.executingCommand.set(instance, { genOrPromise, initializer })

    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    const generator = this.wrapper(instance, handler, ctx, {
      timeout,
      timeoutMessage,
      name: initializer.name,
      type: 'command',
    })()

    let returnValue: any
    let nextValue: any

    while (true) {
      // NOTE: We may also get a function to execute on the instance
      // to provide first value to be passed to the generator, so the
      // developer may get that value just by doing `const value = yield`

      const { value, done } = await generator.next(nextValue)
      if (done) {
        returnValue = value
        break
      }

      nextValue = await generator.next(nextValue)
    }

    this.askedInputInCommand.delete(instance)
    this.executingCommand.delete(instance)
    return returnValue
  }

  async fireOnAction(instance: IBot, ctx: ContextMessageUpdate, initializer: ActionInfo) {
    if (!(await this.canFire(instance, ctx, initializer))) {
      return
    }

    const command = this.executingCommand.get(instance)

    //@ts-ignore
    const genOrPromise = initializer.handler.call(instance, ctx, command?.initializer?.name)

    if (isGenerator(genOrPromise)) {
      return await this.iterate(instance, ctx, genOrPromise)
    }
    else if (isPromise(genOrPromise)) {
      return await genOrPromise
    }
    else {
      return genOrPromise
    }
  }

  async fireOnHears(instance: IBot, ctx: ContextMessageUpdate, initializer: HearsInfo) {
    if (!(await this.canFire(instance, ctx, initializer))) {
      return
    }

    //@ts-ignore
    const { opts, handler } = initializer
    //@ts-ignore
    const { executeDuringCommand, othersMayHear = false } = opts

    if (!executeDuringCommand && this.askedInputInCommand.get(instance)) { return }

    const { message } = ctx
    if (!message) { return }

    const { text } = message
    if (!text) { return }

    if (this.executingHear.has(instance)) {
      if (!othersMayHear) {
        return
      }
    }

    //@ts-ignore
    const executionCounts: Dictionary<number> = instance[ SYM_HEAR_EXEC_COUNTS ]
    const executionCount = executionCounts[ initializer.name ]

    if (isFinite(executionCount)) {
      if (executionCount > 0) {
        //@ts-ignore
        executionCounts[ initializer.name ] = executionCount - 1
      }
      else {
        return
      }
    }

    //@ts-ignore
    const { keepMatchResults, emitsEvent, match } = opts

    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    //@ts-ignore
    const matches = text.match(initializer.match)!
    _resetMatchArray(instance, matches)

    //@ts-ignore
    instance.lastMatch = matches

    const parameters = matches.slice(1)
    parameters.push(matches[ 0 ])

    const genOrPromise = handler.apply(instance, parameters)

    if (emitsEvent) {
      this.emit(instance, 'hears.call', 'i', match)
    }

    let value: any

    if (isGenerator(genOrPromise)) {
      const opts = { ...initializer, generator: genOrPromise }
      this.executingHear.set(instance, opts)
      value = await this.iterate(instance, ctx, genOrPromise)
    }
    else if (isPromise(genOrPromise)) {
      this.executingHear.set(instance, initializer)
      value = await genOrPromise
    }
    else {
      this.executingHear.set(instance, initializer)
      value = genOrPromise
    }

    if (!keepMatchResults) {
      _resetMatch(instance,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0
      )
    }

    if (!WaitingStates.isWaitingFor(ctx.from!.id!)) {
      this.executingHear.delete(instance)
    }

    return value
  }

  private wrapper(instance: IBot, func: Func, ctx: ContextMessageUpdate, options: IIteratorOpts = {}) {
    const that = this
    let timeoutId: any

    return async function* (...args: any[]) {
      //@ts-ignore
      instance[ SYM_CONTEXT ] = ctx

      const result = await func.apply(instance, args)
      if (result instanceof Error) {
        ctx.reply(_(result.message, ctx.from?.language_code || 'en', result.message)!)
        return result
      }

      if (isGenerator(result)) {
        let { timeout, timeoutMessage = 'Timed out' } = options
        if (timeoutId) { clearTimeout(timeoutId) }

        if (timeout) {
          timeoutId = setTimeout(() => {
            result.return(new Error(timeoutMessage))
            ctx.reply(_(timeoutMessage, ctx.from?.language_code || 'en', timeoutMessage)!)
          }, timeout)
        }

        const returnValue = await that.iterate(instance, ctx, result, options)

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }

        return returnValue
      }
      else {
        return result
      }
    }
  }

  private async iterate(instance: IBot, ctx: ContextMessageUpdate, gen: AsyncGenerator | Func, options: IIteratorOpts = {}) {
    let nextValue: any
    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    try {
      if (typeof gen === 'function') {
        const { parameters = [] } = options
        gen = gen.apply(instance, parameters)
      }

      if (!isGenerator(gen)) {
        const result = await gen
        return result
      }

      while (true) {
        const iterationResult = await gen.next(nextValue)
        nextValue = undefined
        const { value, done } = iterationResult

        if (done) {
          return value ?? nextValue
        }

        if (typeof value === 'string') {
          const msg = await this.replyMessage({ message: value }, ctx)
          if (typeof msg === 'object') {
            this.lastMessageSent = msg
          }

          continue
        }
        else if (typeof value === 'number') {
          const msg = await this.replyMessage({ message: value.toString() }, ctx)
          if (typeof msg === 'object') {
            this.lastMessageSent = msg
          }

          continue
        }
        else if (typeof value !== 'object') { continue }

        if (isInputOptions(value)) {
          if (this.executingCommand.has(instance)) {
            this.askedInputInCommand.set(instance, true)
          }

          nextValue = await this.askForInput(value, ctx, instance)
        }
        else if ('message' in value || typeof value.edit === 'string') {
          nextValue = await this.replyMessage(value, ctx)
        }
        else if (isNotificationInfo(value)) {
          await this.notifyUsers(options.name!, options.type!, value, ctx)
          continue
        }
        else if (isSetActionMessage(value)) {
          const { chat } = ctx
          if (!chat) { continue }

          const { action, wait } = value
          await new Promise((resolve, reject) => {
            ctx.telegram
              .sendChatAction(chat.id, action)
              .catch(reject)
              .then(() => {
                if (wait) { setTimeout(resolve, 5000) }
                else {
                  resolve()
                }
              })
          })
        }
        else if (isInlineMenu(value)) {
          let {
            inlineMenu: im,
            closeOnTimeout,
            timeoutMessage = '',
            onSelected,
            extra,
          } = value

          let resolver: Function | undefined

          if (!(SYM_CBHANDLER_FUNCTION in instance)) {
            CBHandler.setMenuKeeper(instance)
            CBHandler.setOnMenuClose(function menuCloseResolver() {
              if (typeof resolver === 'function') {
                resolver()
                resolver = undefined
              }
            })

            const { botSettings } = this
            const {
              catchFunction = 'onError',
            } = botSettings

            CBHandler.setOnError(function callbackQueryError(error: Error) {
              //@ts-ignore
              const errorHandler: Function = instance[ catchFunction ]

              if (typeof errorHandler === 'function') {
                errorHandler.call(instance, error)
              }
            })

            Object.defineProperty(instance, SYM_CBHANDLER_FUNCTION, {
              configurable: false,
              enumerable: false,
              value: true
            })
          }

          let that = this
          let menuMessage: Message | undefined
          try {
            nextValue = await new Promise(async function inlineMenuHandler(resolve, reject) {
              resolver = resolve
              let willResolveManually = true

              if (typeof im === 'function') {
                im = await im(resolve, reject)

                if (typeof onSelected !== 'function') {
                  im = await im
                }

                willResolveManually = false
              }

              im = await inlineMenu(im as IMenu)

              try {
                const sentMessage = await CBHandler.showMenu(ctx, im, extra)
                if (typeof sentMessage === 'object') {
                  menuMessage = sentMessage
                  that.lastMessageSent = menuMessage
                }

                if (willResolveManually) {
                  resolve()
                  resolver = undefined
                }
              }
              catch (error) {
                reject(error)
              }
            })
          }
          catch (error) {
            if (error instanceof Error) {
              if (error.message === 'Timeout') {
                if (closeOnTimeout) {
                  timeoutMessage = timeoutMessage.trim()
                  CBHandler.activeMenu = undefined
                  if (!menuMessage) {
                    nextValue = undefined
                    continue
                  }

                  const { chat, message_id } = menuMessage

                  if (timeoutMessage) {
                    const result = await ctx.telegram.editMessageText(
                      chat.id,
                      message_id,
                      undefined,
                      timeoutMessage,
                      Extra.markup(Markup.inlineKeyboard([]))
                    )

                    if (typeof result === 'object') {
                      this.lastMessageSent = result
                    }
                  }
                  else {
                    if (await ctx.deleteMessage(message_id)) {
                      this.lastMessageSent = undefined
                    }
                  }

                  nextValue = undefined
                }
              }
            }
          }
        }
        else if (value.getLastMessage === true) {
          nextValue = this.lastMessageSent
        }
        else if (nextValue === SYM_PROMISE_REPLACE) {
          return SYM_PROMISE_REPLACE
        }

        if (typeof nextValue === 'string' && nextValue.startsWith('/')) {
          return
        }
      }
    }
    catch (error) {
      const { catchFunction = 'onError', printStackTrace = true } = this.botSettings
      if (catchFunction in instance) {
        await (instance as any)[ catchFunction ].call(instance, error)
      }
      else if (printStackTrace) {
        console.error(error)
      }
    }
  }

  async askForInput(inputObj: IInputOpts, ctx: ContextMessageUpdate, instance?: any) {
    let {
      match,
      matchError = 'Invalid Input',
      retry = 0,
      timeout,
      keepAsking = false,
      didMessageSend,
      cancelPrevious,
      matchErrorExtra,
    } = inputObj

    if (!keepAsking) {
      //@ts-ignore
      const lastMessage = await this.replyMessage(inputObj, ctx)
      if (typeof lastMessage === 'object') {
        await didMessageSend?.(lastMessage)
      }
    }

    do {
      --retry

      if (keepAsking) {
        //@ts-ignore
        const lastMessage = await this.replyMessage(inputObj, ctx)
        if (typeof lastMessage === 'object') {
          await didMessageSend?.(lastMessage)
        }
      }

      let userMessage: IncomingMessage
      if (cancelPrevious) {
        userMessage = await WaitingStates.cancelAndReplace(ctx.from!.id, false, timeout)
      }
      else {
        userMessage = await WaitingStates.waitForUser(ctx.from!.id, false, timeout)
      }

      //@ts-ignore
      if (userMessage === SYM_PROMISE_REPLACE) {
        return userMessage
      }

      if (match) {
        if (typeof match === 'string') {
          match = new RegExp(match)
        }

        if (!userMessage.text) {
          if (matchError) {
            await this.replyMessage({ message: _(matchError, ctx.from?.language_code || 'en', matchError)! }, ctx)
          }

          continue
        }

        const { text } = userMessage
        if (text.startsWith('/') && instance && this.executingHear.has(instance)) {
          const info = this.executingHear.get(instance)!
          const { generator, opts } = info
          const { ignoreCommands } = opts
          if (!ignoreCommands) {
            if (generator) {
              await generator.return(SYM_PROMISE_REPLACE)
            }

            this.executingCommand.delete(instance)
            return SYM_PROMISE_REPLACE
          }
        }

        if (text.match(match)) {
          return text
        }
        else if (matchError && retry > 0) {
          let message = _(matchError, ctx.from?.language_code || 'en', matchError)!
          await this.replyMessage({ message, extra: matchErrorExtra }, ctx)
        }
      }
      else {
        return userMessage.text
      }
    }
    while (retry > 0)

    return false
  }

  async replyMessage(messageObj: IReplyMessage, ctx: ContextMessageUpdate): Promise<Message | undefined | boolean> {
    let {
      //@ts-ignore
      input,
      edit,

      message = input,
      extra,
    } = messageObj

    if (typeof message !== 'object' && message) {
      message = String(message)
    }

    if (typeof edit === 'string') {
      if (typeof message === 'undefined') {
        message = edit
        edit = true
      }
    }

    if (typeof message === 'string') {
      if (edit) {
        let editMessageId: number
        if (typeof edit === 'object') {
          if (edit.text === message) {
            return false
          }

          editMessageId = edit.message_id
        }
        else if (typeof edit === 'string' || typeof edit === 'number') {
          editMessageId = Number(edit)
        }
        else if (typeof edit === 'boolean') {
          let value: Message | boolean | undefined
          try {
            value = await ctx.editMessageText(message, extra)
          }
          catch (error) {
            if (typeof this.lastMessageSent === 'object') {
              if (error.message === 'Telegraf: "editMessageText" isn\'t available for "message::text"') {
                value = await ctx.telegram.editMessageText(
                  ctx.chat?.id,
                  this.lastMessageSent?.message_id,
                  undefined,
                  message,
                  extra
                )
              }
              else {
                throw error
              }
            }
            else {
              throw error
            }
          }

          return value
        }
        else {
          throw new Error(`The given "edit" property was invalid: ${String(edit)}`)
        }

        return await ctx.telegram.editMessageText(
          ctx.chat?.id,
          editMessageId,
          undefined,
          message,
          extra
        )
      }
      else {
        return await ctx.reply(message, extra)
      }
    }
    else if (isImageReplyMessage(messageObj)) {
      const { source, caption } = messageObj.message
      const { extra } = messageObj
      let photoExtra = extra as ExtraPhoto

      if (typeof caption === 'string') {
        photoExtra = { ...(photoExtra || {}), caption }
      }

      if (typeof source === 'string') {
        let file: InputFile
        if (/^https?:\/\//.test(source)) {
          const sections = source.split('/')
          const filename = sections[ sections.length - 1 ]
          file = { url: source, filename }

          let timerId: any
          if (this.botSettings.autoUpdateStatus) {
            ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
            timerId = setTimeout(function actionSetter() {
              ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
              timerId = setTimeout(actionSetter, 5000)
            }, 5000);
          }

          const response = await ctx.replyWithPhoto(file, photoExtra)
          if (timerId) { clearTimeout(timerId) }
          return response
        }
        else {
          let exactPath = source
          if (source.startsWith('~/')) {
            exactPath = join(process.cwd(), source.slice(2))
          }

          if (existsSync(exactPath)) {
            return new Promise((resolve, reject) => {
              readFile(exactPath, (error, source) => {
                if (error) { reject(error) }
                else {
                  let timerId: any
                  let resolver = resolve
                  if (this.botSettings.autoUpdateStatus) {
                    resolver = function (...args) {
                      clearTimeout(timerId)
                      resolve(...args)
                    }

                    ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
                    timerId = setTimeout(function actionSetter() {
                      ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
                      timerId = setTimeout(actionSetter, 5000)
                    }, 5000);
                  }

                  ctx.replyWithPhoto({ source }, photoExtra).then(resolver).catch(reject)
                }
              })
            })
          }
          else {
            throw new Error(`Path could not be found: "${source}"`)
          }
        }
      }
      else if (Array.isArray(source)) {
        const mediaGallery = (source as any[]).map((it, index) => {
          if (typeof it === 'string') {
            if (!it.startsWith('http')) {
              throw new Error(`Tried to send a media without URL: "${it}" at index: ${index}`)
            }

            return { type: 'photo', media: it, caption }
          }
          else if (Array.isArray(it)) {
            const [ source, caption ] = it
            if (!source.startsWith('http')) {
              throw new Error(`Tried to send a media without URL: "${source}" at index: ${index}`)
            }
            return { type: 'photo', media: source, caption }
          }
          else if (typeof it === 'object') {
            it.type = 'photo'
            it.media = it.source
            it.caption = it.caption || caption

            if (!it.media.startsWith('http')) {
              throw new Error(`Tried to send a media without URL: "${it.media}" at index: ${index}`)
            }

            return it
          }
        }) as MessageMedia[]

        let timerId: any
        if (this.botSettings.autoUpdateStatus) {
          ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
          timerId = setTimeout(function actionSetter() {
            ctx.telegram.sendChatAction(ctx.chat!.id, 'upload_photo')
            timerId = setTimeout(actionSetter, 5000)
          }, 5000);
        }

        while (mediaGallery.length >= 2) {
          const currentGroup = mediaGallery.splice(0, 10)
          await ctx.replyWithMediaGroup(currentGroup, extra as any)
        }

        let returnValue: MessagePhoto | undefined
        if (mediaGallery.length) {
          const [ photo ] = mediaGallery
          if (photo.caption && photo.caption !== photoExtra.caption) {
            photoExtra.caption = photo.caption
          }

          returnValue = await ctx.replyWithPhoto({ source: photo.media }, photoExtra)
        }

        if (timerId) { clearTimeout(timerId) }
        return returnValue
      }
      else {
        throw new Error(`Invalid type for image source: "${typeof source}"`)
      }
    }
    else {
      throw new Error('replyMessage can only send string messages for now.')
    }
  }

  async notifyUsers(name: string, type: 'action' | 'command' | 'hears', messageObj: INotificationInfo, ctx: ContextMessageUpdate): Promise<boolean | Error | (boolean | Error)[] | undefined> {
    const { template, notify, extra } = messageObj
    const { username, id } = ctx.from!
    const now = new Date()
    const epoch = ~~(now.getTime() / 1000)

    let { templateSource } = messageObj
    if (typeof templateSource !== 'object') {
      templateSource = {}
    }

    const data = {
      id,
      username,
      epoch,
      date: now,
      now,
      type,
      name,

      i: id,
      u: username,
      d: now,
      e: epoch,
      t: type,
      n: name,
      ...templateSource,
    }

    const result = compileTemplate(template)(data)

    if (typeof notify === 'string' || typeof notify === 'number') {
      try {
        await ctx.telegram.sendMessage(notify, result, extra)
        return true
      }
      catch (error) {
        if (typeof error === 'string') {
          error = new Error(error)
        }

        return error
      }
    }
    else if (Array.isArray(notify)) {
      for (let i = notify.length - 1; i >= 0; --i) {
        const target = notify[ i ]

        try {
          await ctx.telegram.sendMessage(target, result, extra)
          //@ts-ignore
          notify[ i ] = true
        }
        catch (error) {
          if (typeof error === 'string') {
            error = new Error(error)
          }

          notify[ i ] = error
        }
      }

      return notify as any as boolean[]
    }
  }

  private emit(instance: any, name: string, type: 'e' | 'i', data?: any) {
    if (!(SYM_EVENTS in instance)) { return }
    if (typeof data !== 'undefined') {
      if (typeof data !== 'string') {
        data = JSON.stringify(data)
      }
    }

    return instance[ SYM_EVENTS ].next({
      name,
      type,
      data
    })
  }

  private async sendBlockedMessageIfNeeded(instance: any, messageOrKey: string | Function, ctx: ContextMessageUpdate, initializer: InitInfo, user: User) {
    let message: string
    if (typeof messageOrKey === 'string') {
      message = messageOrKey
    }
    else if (typeof messageOrKey === 'function') {
      message = await messageOrKey.call(instance, initializer.type, initializer.name, user.id, user.username)
    }
    else {
      throw new Error('The type should be string or function')
    }

    message = _(message, user.language_code ?? 'en', message)!
    let extra: ExtraEditMessage | undefined
    if ('opts' in initializer) {
      const { blockMessageExtra } = initializer.opts

      if (typeof blockMessageExtra === 'function') {
        extra = await blockMessageExtra.call(instance, initializer.type, initializer.name, user.id, user.username)
      }
      else if (typeof blockMessageExtra === 'object') {
        extra = blockMessageExtra
      }
    }

    await this.replyMessage({ message, extra }, ctx)
  }

  private async canFire(instance: any, ctx: ContextMessageUpdate, initializer: InitInfo) {
    const { from } = ctx
    if (!from) { return false }

    const { name, type } = initializer

    if ('opts' in initializer) {
      const { opts } = initializer
      const { onceForBot, onceForBotIn, blockMessage, botBlockMessage = blockMessage } = opts

      const { message } = ctx
      if (message) {
        const { text } = message
        if (text && text.startsWith('/')) {
          if (type === 'hears') {
            const { ignoreCommands = false } = opts as IHearsDecoratorOpts
            if (!ignoreCommands) {
              if (this.executingHear.has(instance)) {
                const info = this.executingHear.get(instance)!
                if (typeof info.generator === 'object') {
                  await info.generator.return(SYM_PROMISE_REPLACE)
                }

                this.executingHear.delete(instance)
              }

              return false
            }
            else if (this.executingHear.has(instance)) {
              const info = this.executingHear.get(instance)!
              if (info.name === initializer.name) {
                return false
              }
            }
          }
        }
      }

      if (onceForBot) {
        let settings = this.onceExecutions.get(instance)
        if (!settings) {
          this.onceExecutions.set(instance, settings = {})
        }

        if (settings[ name ]) {
          this.emit(instance, 'perm.exec', 'i', {
            type: initializer.type,
            name: initializer.name,
            id: from.id,
            username: from.username,
            blocking: 'onceForBot'
          })

          if (typeof botBlockMessage === 'string' || typeof botBlockMessage === 'function') {
            await this.sendBlockedMessageIfNeeded(instance, botBlockMessage, ctx, initializer, from)
          }

          return false
        }

        settings[ name ] = true
        return true
      }
      else if (onceForBotIn) {
        let settings = this.onceExecutions.get(instance)
        if (!settings) {
          this.onceExecutions.set(instance, settings = {})
        }

        const now = (new Date()).getTime()
        if (name in settings) {
          const execTime = settings[ name ] as number
          if (now > execTime) {
            settings[ name ] = now + onceForBotIn
            return true
          }
          else {
            this.emit(instance, 'perm.exec', 'i', {
              type: initializer.type,
              name: initializer.name,
              id: from.id,
              username: from.username,
              blocking: 'onceForBotIn',
              remaining: now - execTime
            })

            if (typeof botBlockMessage === 'string' || typeof botBlockMessage === 'function') {
              await this.sendBlockedMessageIfNeeded(instance, botBlockMessage, ctx, initializer, from)
            }

            return false
          }
        }
        else {
          settings[ name ] = now + onceForBotIn
          return true
        }
      }

      if ('onceForUser' in opts || 'onceForUserIn' in opts) {
        const { onceForUser, onceForUserIn, blockMessage, userBlockMessage = blockMessage } = opts
        const state = instance[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
        const userSettings = (
          state[ SYM_ONCE as any as string ]
          || (state[ SYM_ONCE as any as string ] = {
            value: {} as Dictionary<Dictionary<{ interval: number }>>,
            props: {}
          })
        ).value

        if (onceForUser) {
          if (!(type in userSettings)) {
            userSettings[ type ] = {}
          }

          const funTypes = userSettings[ type ]
          if (!(name in funTypes)) {
            funTypes[ name ] = Infinity
            return true
          }
          else {
            this.emit(instance, 'perm.exec', 'i', {
              type: initializer.type,
              name: initializer.name,
              id: from.id,
              username: from.username,
              blocking: 'onceForUser'
            })

            if (typeof userBlockMessage === 'string' || typeof userBlockMessage === 'function') {
              await this.sendBlockedMessageIfNeeded(instance, userBlockMessage, ctx, initializer, from)
            }

            return false
          }
        }
        else if (onceForUserIn) {
          if (!(type in userSettings)) {
            userSettings[ type ] = {}
          }

          const now = new Date().getTime()
          const funTypes = userSettings[ type ]
          if (!(name in funTypes)) {
            funTypes[ name ] = now + onceForUserIn
            return true
          }
          else {
            const allowanceEpoch = funTypes[ name ]
            if (now > allowanceEpoch) {
              funTypes[ name ] = now + onceForUserIn
              return true
            }
            else {
              this.emit(instance, 'perm.exec', 'i', {
                type: initializer.type,
                name: initializer.name,
                id: from.id,
                username: from.username,
                blocking: 'onceForUserIn',
                remaining: now - allowanceEpoch
              })

              if (typeof userBlockMessage === 'string' || typeof userBlockMessage === 'function') {
                await this.sendBlockedMessageIfNeeded(instance, userBlockMessage, ctx, initializer, from)
              }

              return false
            }
          }
        }
      }

    }

    return true
  }
}

const executer = new Executer()

export function handleActions(instance: any, initializer: InitInfo) {
  return async function _handleActions(ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    try {
      await executer.fireOnAction(instance, ctx, initializer as ActionInfo)
    }
    catch (error) {
      if (typeof error === 'string') { error = new Error(error) }
      if (typeof instance.onError === 'function') { instance.onError(error) }
      else {
        throw error
      }
    }
  }
}

export function handleCommands(instance: any, initializer: InitInfo) {
  return async function _handleCommand(ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    try {
      await executer.fireOnCommand(instance, ctx, initializer as CommandInfo)
    }
    catch (error) {
      if (typeof error === 'string') { error = new Error(error) }
      if (typeof instance.onError === 'function') { instance.onError(error) }
      else {
        throw error
      }
    }
  }
}

export function handleHears(instance: any, initializer: InitInfo) {
  return async function _handleHears(ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    try {
      await executer.fireOnHears(instance, ctx, initializer as HearsInfo)
    }
    catch (error) {
      if (typeof error === 'string') { error = new Error(error) }
      if (typeof instance.onError === 'function') { instance.onError(error) }
      else {
        throw error
      }
    }
  }
}

export function handleGeneric(instance: any, initializer: InitInfo) {
  return async function _handleGeneric(ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    try {
      await executer.fireGeneric(instance, ctx, initializer)
    }
    catch (error) {
      if (typeof error === 'string') { error = new Error(error) }
      if (typeof instance.onError === 'function') { instance.onError(error) }
      else {
        throw error
      }
    }
  }
}

export function handleMenuAction(instance: any, initializer: MenuInfo) {
  return async function _handleMenuAction(ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    try {
      await executer.fireGeneric(instance, ctx, initializer)
    }
    catch (error) {
      if (typeof error === 'string') { error = new Error(error) }
      if (typeof instance.onError === 'function') { instance.onError(error) }
      else {
        throw error
      }
    }
  }
}

export function askForInput(inputObj: IInputOpts, ctx: ContextMessageUpdate) {
  return executer.askForInput(inputObj, ctx)
}

export function replyMessage(messageObj: IReplyMessage, ctx: ContextMessageUpdate) {
  return executer.replyMessage(messageObj, ctx)
}

export function setExecuterBotSettings(botSettings: IBotSettings) {
  executer[ 'botSettings' ] = botSettings
}

function _resetMatch(instance: any, a: any, b: any, c: any, d: any, e: any, f: any, g: any, h: any, i: any, j: any) {
  instance[ '$0' ] = a
  instance[ '$1' ] = b
  instance[ '$2' ] = c
  instance[ '$3' ] = d
  instance[ '$4' ] = e
  instance[ '$5' ] = f
  instance[ '$6' ] = g
  instance[ '$7' ] = h
  instance[ '$8' ] = i
  instance[ '$9' ] = j
}

function _resetMatchArray(instance: any, array: any[]) {
  _resetMatch(
    instance,
    array[ 0 ],
    array[ 1 ],
    array[ 2 ],
    array[ 3 ],
    array[ 4 ],
    array[ 5 ],
    array[ 6 ],
    array[ 7 ],
    array[ 8 ],
    array[ 9 ]
  )
}
