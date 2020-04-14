# telegram-bot-framework
Telegram bot framework wrapper for Telegram bot development, utilizes `Telegraf` library.

This library provides bunch of useful functions and types that lets you define your functions
and expect inputs from user, using the last features of the JavaScript/TypeScript language
such as generators and async functions.

This library also provides a way of communication to the outer library thorugh sending events
by RxJS and also may use functions from outer library to utilize them to provide content
and determine the specific reactions/behavious this implementation has.

For example, by using this library functions, you will be able to `yield` messages and
keep asking for an input each time until it passes the `RegExp` you have set, and may also
show an error message on wrong input, while providing strings in many languages by registering
your language by code and your strings and use them in the messaegs.

**Feel free** to improve this logic and helper functions to provide easier way to common
actions that usually bot writes do.

For now, every action may be wrapped by the `actionFunction` which will require a function input
or a function descriptor object, then the function will have a context with useful informations
that could be reachable by `this` keyword.

Some of those functions are:
- `getUserData$()`: Gets an user data saved previously or may return the provided default value.
- `setUserData$()`: Sets an user data.
- `input$()`: Asks user to enter an input, the function will suspend there when used with `await`.
- `message$()`: Sends a message to the user.
- `number$()`: Ask user to input a number
- `input()`: Generator returning version of `input$()`, so you may just save the state or track
previous inputs or simply provide trials before stopping the function execution.

As you realize, the functions ending with dollar-sign `$` are async functions. The others are generator functions.

The `{get,set}UserData$()` functions will be used the source provided during the framework setup. So you may
provide a function to let the actionFunctions use that to retrieve the user data when needed or set the user data.
These functions are async also, hence you can await them if needed. Normally, the framework will use normal
JavaScript object to keep data of the users. Important to know that the keys of these data are in number type
indicating the Telegram ID of the users.

There are also some properties you may use in the function context such as `lang`, the language of the user.
Of course, the `lang` property may be updated or provided a default value during setup.

If you want to support to the project:

```md
- Bitcoin     : 153jv3MQVNSvyi2i9UFr9L4ogFyJh2SNt6
- Bitcoin Cash: qqkx22yyjqy4jz9nvzd3wfcvet6yazeaxq2k756hhf
- Ether       : 0xf542BED91d0218D9c195286e660da2275EF8eC84
- Stellar     : GATF6DAKFCYY3MLNAIWVISARP52EWPOPFFZT4JMFENPNPERCMTSDFNY5
```

# Examples
```ts
export function installActions(bot: Telegraf<ContextMessageUpdate>) {
  // The below you will see the examples of action functions.
  // You may either pass async generator function or information object of it.

  // The functions have number$(), message$(), input$() async functions.
  // Likewise, the context of the function (this) is modified and can reach
  // values like its name defined below, or helper functions as listed above
  // or generator functions of such helper functions such as input()

  bot.command('init,' actionFunction({
    name: 'init',
    async * call() {
      const age: number = await this.number$({ message: 'Hello, please enter your age' })

      if (age < 18) {
        await this.message$({ message: 'You are so young' })
      }
      else {
        await this.message$({ message: 'You are an adult' })
      }
    }
  }))

  bot.command('creategroup', actionFunction(async function * remindMe() {
    // The getUserData$() and setUserData$() functions are async and can be
    // modified by you how to set and get those values, useful for situations
    // such as providing values from the database or writing into.
    // If not provided, normal JavaScript object will be used for user data.

    const userGroupInfo = await this.getUserData$('groupInfo')
    if (!userGruopInfo) {
      // You can send user a translation of a message selected by the
      // language user set or default you have provided.
      await this.message$({ message: _('ErrorNoGroup', this.lang) })

      // Simply return from the function to stop interaction with user.
      return
    }

    // Lets say you want to show set of buttons to the user to provide an
    // option.
    const groupButtons = userGroupInfo.createdGroups.map(it => {
      return {
        text: it.name,
        callback_data: it.name
      }
    })

    // Ask user an input in generator-style, instead of input$()
    // Both styles could be used for this.
    // It is recommended using generator way if the user may respond lately.
    const input = yield* this.input({
      message: _('ChooseGroup', this.lang),
      extras: Extra.markup(Markup.keyboard(groupButtons))
    })

    const selectedGroup = groupButtons.find(it => it.name === input)
    if (!selectedGroup) { return }

    // The following will keep asking the user until the input matches.
    // For errors, the given key will be used to find the corresponding
    // translation to show user each time.
    const selectionAmount = yield* this.input({
      message: _('UserNumber', this.lang),
      match: /(\d+?)/,
      matchError: 'WrongInput' // Key of a translation set
    })

    selectedGroup.select(parseInt(selectionAmount, 10))
    // You can set manual messages to show the user while still translating
    // the part of the string, or you may even use a string formatter for this.
    await this.message$({
      message: `${_('NewSelection')}: ${selectedGroup.range}`
    })
  }))
}
```
