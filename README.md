# telegram-bot-framework
Telegram bot framework wrapper for Telegram bot development,
utilizes `Telegraf` library.

This library provides set of decorators that could be used for a class and its
properties and functions for the behavior of the bot.

- `@bot(settings?: IBotSettings)` class decorator: This decorator is used for
a class to mark it is the logical implementations of the bot behaviors.
The functions inside of the class will be used as `action` and `command`
functions. Additionally, it enables this class to have its user/client
dependent properties.

- `@action(settings?: IActionDecoratorOpts)` method decorator: This decorator
is used to mark a function as an action of the bot. So that when a command is
called, it could have `callback_data` equals to the function name or the name
defined in the settings to execute the function.

- `@command(settings?: ICommandDecoratorOpts)` method decorator: This decorator
is used to mark a function as a command of the bot. So that when a command is
sent by the client matching the name of the function, or with the name given in
the settings.

- `@hears(settings: IHearsDecoratorOpts | string)` method decorator: This
decorator is used to mark a function as a `hears` handler of the bot.
This decorator takes either a string for **exact match** or an object
describing the information and the regular expression to match when user sends
a message. Additionally, the match groups will be passed as parameters to the
function.

- `@help()` method decorator: This decorator is used to mark a function as the
corresponding function for `/help` command. This decorator is provided to
provide a way of having a function with any name to make it `/help` function.
Instead, you may use a function with **help** name as usual and it will be
assumed as the function for `/help`. The **help** function may be both async
and generator.

- `@state(settings?: IBotStateSettings)` property decorator: This decorator is
used to mark a property as user/client dependent property.
Hence, the property is user based, each user will have its own value of
the property. In this way, it is possible to have properties for the bot
itself and the current user invoking the function.

## General Information
The recommended style of coding is, declaring functions inside of the class
with their roles in the bot. For example, if the function is corresponding
to a command the bot has, then decorating it with `@command()` decorator.
Likewise, if the function is corresponding to an action the bot has, the
`@action()` decorator.

Each of the decorators have their default values, so it could be left empty
(no parameters given).

The system provided with the `@bot()` decorator allows all of the functions
to be async, hence, it is recommended to make all of your functions async if
it is better.
Additionally, the system also provides a way of handling with generator
functions, so it is even better if you want to have more control over your
function. In this way, you can simply `yield` a message, or an input, and
the generator will be awaiting for the user input that you can get from the
`yield` value.

The function may be both async and generator functions. Hence, you can both
`await` for async actions, and `yield` for inputs or messages.

The system supports multilanguage responses, the `input` and `message` property
of the `yield` values or the messages passed to `input$()` and `message$()`
functions would be `keys` defined before to get the translated message. You can
still use `_` (underscore) function to get the translation and format it
however you wish.

The `@bot()` class decorator adds some functions and properties to the class
to provide easy access to the context and the `Telegraf` reference including
with helper functions like `input$()` and `message$()`.

Generally, bots will be reacting to the multiple users all-together. So
it is recommended to have such properties defined in the class with `@state()`
decorator.

We may count the `@command()` functions as the enterance points to the bot,
since user will be able to call this functions directly with any `/command`.
And the `@action()` are defined in the `@command()` to provide alternative
execution flow/steps. There are several issues with this:
- User may re-execute a command function, which then the state should be
invalidated.
- User may execute a command function and does not reply with any message.
Which may cause memory problems since the user infomation is kept in memory.

To prevent such cases, the `@command()` decorator provides `resetStates`
option which is an array of strings or strings with new values. Use this
property if some of your user properties should be reset before executing
another flow. Additionally, `@command()` provides timeout property.

Actions should have the same name with `callback_data`, so `@action()` function
name should match. It is also possible to rename/alias these function names
by setting `name` property for both of `@command()` and `@action()`.

For async functions, since they are not generators, it is not possible to yield
an object to ask for input or sending a message. For this, you can use
`input$()` and `message$()` async functions to provide the same functionality.

To start the bot, just create an instance of the class. And then just
`.start()` the bot.

## Approach
- Ensure you have BOT_TOKEN environment (or you can change this)
- Decorate your class with `@bot()`
- Define the properties you will use for the bot itself and user data.
- Decorate user data with `@state()`
- Define command functions and decorate them with `@command()`. Better
if async generators.
- Define action functions and decorate them with `@action()`.
- Define custom functions when user sends a message and that matches with
`@hears()`.
- Have a cancel/cleanup function and reset all user variable. Also
`cancelInput()` to prevent to process previous input from user if there
is any function awaiting any.

Several cases to be **careful**:
First, if you have function that awaits for an user input and that function
can be called multiple times (like, by an action function), then the previous
await statement would be resulted in `cancelled` state so you should be careful
about checking whether the value returned from the user input (`input$()`)
is cancelled or not.

For example, if you have a search engine and the actual logic implementation of
the search is extracted as another function called `doSearch(text: string)`,
and your command function is `search()` and it uses `doSearch(text: string)`,
and you send input message with some `extra` input actions for navigating next
and previous which will chage the user `state` property of `pageIndex`, in that
case you should have a check whether the returned value from the search is
a cancel symbol or not. Because whenever the user navigates to other page and
executes `doSearch(text: string)` function again after increasing the
`pageIndex` so the next page will be returned, the previous page would be still
waiting for an user input. And if user replies to the message, the message will
be processed by the latest call and the first call will result with cancel sym.

You should also be careful about user states. They are not belonging to
the class' own instance only, they are owned differently for each user. So
changing for one user may not affect all users. For common properties, do not
decorate them with `@state()` decorator since that is not a user state in this
case but the state of the bot.

The result of the `input$()` may result as `false`, which means that the user
input did not match. In that case, you may simply cancel the operation by
returning from an if block you check for this.

If you want to have dynamic action visibilities, then set `hide` property to
one of your `@state()` properties. For example, in the previous example, if
you know how much page you have, for next button you could have the condition
such as `this.searchIndex === pageCount - 1`, so at last page, the next button
is now hidden.

To edit the same message again and again to provide some functionality similar
to pagination, use `didMessageSend(message: Message)` function to get the last
sent message by the bot and set it to one `state` property, such as
`@state() private _messageToUpdate?: Message`, then pass this variable to the
input call like:

```js
const selection = await this.input$({
  input: `Page: ${pageIndex}\n${list}`,
  edit: this._messageToUpdate,
  match: /^(next|prev|cancel|\d\d?)$/i,
  matchError: 'Please enter "next", "prev", "cancel" or a number',
  cancelPrevious: true,
  didMessageSend: async (message) => { this._messageToUpdate = message },
})

if (this.isCancelled(selection)) {
  // Cancelled by second call (the await above)
  return
}

if (!selection) {
  // User message did not match
  return
}
```

In this way, you will be able to update the message to update next time and
pass that variable to `edit` property.

Another **important** thing in the given example above is `cancelPrevious`
property. It indicates that this input call will cancel the previous one so
that the previous function call will be resolved with cancel symbol. Which is
handled by the following condition in the example.

Lastly, for **hears** decorated functions, when the string is passed as a
filter, then the string is expected to match exactly. If you don't want this
you may pass an object containing `match` property as string or `RegExp`.

The hears functions **WILL BE** ignored by default if the message is matched
with the filter but it is sent during a `@command` function execution.
This behavior may be changed in the decorator setting.

## Notes
- You can set usage limits or timeouts (for updating or reading) for the
state properties and also provide the value to assign when it is expired or
timed out.
- You can set a timeout for a command function.
- You can reset several state properties and/or provide the new value for
resetting.
- You can reach the matches with `${NUM}` properties such as `this.$0` for
full match and `this.$9` for the ninth match of the `@hears()` function.
- You can keep the last match of any `@hears()` function by setting
`keepMatchResults` property of the decorator to true.
- You will have matched groups in your parameters for `@hears()` functions.
- You can add middlewares or config the `Telegraf` instance by
overriding/defining the `start()` function inside the class manually and
using the `this.ref` property to manage all of changes before you start.
Don't forget to call `this.init()` to make all of these things work and
`this.ref.launch()` and `this.ref.startPolling()`

- You can listen for events, the package uses RxJS Observables.
- You can disable emitting an event for property changes or action/command
functions.
- You can set `start` function manually, in that case do not forget to call
`init()` function to provide all of these functionalities. If you do not
define `start` function manually, then it will be defined automatically that
starts the bot.
- You can reach the underlying `Telegraf` instance by `this.ref`.
- You can reach the current `ContextMessageUpdate` by `this.context`.
- You can always make a pull request to improve the library!

## Setup
To use this package, adding this package name into `dependencies` section of
your `package.json` file would be enough. Ensure that your node executing this
library supports decorators. You may use a transpiler such as Babel to compile
this to older versions of JavaScript. Hence, you will not have decorator
problem.

If you are using TypeScript, you need to add `typescript` into your
`devDependencies` section of `package.json`. Then you need to have a
`tsconfig.json` file which is used for setting TypeScript compiler properties.
Ensure that you have `experimentalDecorators` property set to `true` in
`compilerOptions`.

You can create this file by `tsc --init` command if you have TypeScript.

After you done the language and the package sides, you just need to run the
file your code is written (or compiled file by TypeScript) and your bot should
be serving.

## Examples
A hello world bot would be like this
```js
@bot()
class SayHiBot {
  @command()
  async * sayHi() {
    yield { message: 'Hello 👋' }
  }
}

const bot = new SayHiBot()
bot.start()
```

---
A bot multiplying a number and reverses a string, and listening for something
would be like

```js
@bot()
class OpBot {
  @command()
  async * multiply() {
    const firstNumStr = yield {
      input: 'Please enter the first number',
      match: /\d+/,
      matchError: 'Invalid number'
    }

    const firstNum = parseInt(firstNumStr, 10)

    const secondNumStr = yield {
      input: 'Please enter a digit to multiply',
      match: /[1-9]/,
      matchError: 'Please enter a digit between 1-9'
    }

    const secondNum = parseInt(secondNumStr, 10)
    const result = firstNum * secondNum
    yield {
      message: `Result is ${result}`
    }
  }

  @command({ name: 'reverse' })
  async * reverseaString() {
    let message = yield {
      input: 'Enter a message to reverse',
    }

    message = message.split('').reverse().join('')
    yield { message }
  }

  @hears('now')
  * sendNow() {
    yield (new Date()).toLocaleString()
  }

  @hears({ match: /(\d+)\s+\+\s+(\d+)/ })
  * add(left: string, right: string, _allMatch: string) {
    yield parseInt(left) + parseInt(right)

    // When user sends 3 +  5
    // left      -> "3"
    // right     -> "5"
    // _allMatch -> "3 +  5"
    //
    // Likewise, you can reach these matches with ${NUM} properties.
    // this.$0   -> "3 +  5"
    // this.$1   -> "3"
    // this.$2   -> "5"
  }
}
```

---
An advanced bot supports pagination. The following example is the one of the
extreme cases you may face with. Here, we have a video downloader bot which
looks through the pages from its source and returns us an object containing
the names of the videos as string array and the total number of pages and
the current page number.

In this example, the bot is editing the last message it sent so the bot will
not be sending many messages since they are similar to each other but instead
will update the last sent message so you will have a pagination-like message
with three buttons under of it and you also provide functions for them in the
class with `@action()`. Likewise, you are hiding the previous and the next
buttons according to the current page index. When cancelled, the cleanup is
done.

Note that the next condition after the value is returned from the observable,
it is checking whether the returned value is a cancel symbol or not. Because
the `input$()` takes an object describing that the previous message will be
cancelled (`cancelPrevious`) and client may send messages until it `match`-es
with the condition and if the client fails for 3 times, the operation is
cancelled (returned false, so the second condition will end the execution).

Also note that the `/search` command has a timeout of 5 seconds and whenever
it is sent again by the user, it invalidates and resets the previous states
of given list.

```ts
@bot()
class VideoDownloaderBot {
  @state() _messageToEdit?: Message
  @state() pageIndex: number = 0
  @state() downloader = new VideoDownloader()
  @state() isSearching = false
  @state() searchQuery?: string

  private doSearch(text?: string) {
    if (this.isSearching) { return }
    text = text || this.searchQuery

    this.isSearching = true
    this.downloader.search$(text, { pageIndex: this.pageIndex }).subscribe(async value => {
      this.isSearching = false
      const { lines } = value
      const selection = await this.input$({
        input: `Page: ${value.pageNumber}\n${lines.join('\n')}`,
        match: /^(next|prev|cancel|\d\d?)$/i,
        matchError: 'Invalid Input',
        extra: Extra.markup(Markup.inlineKeyboard([
          { text: '⬅️', callback_data: 'didPrevClick', hide: this.pageIndex === 1 },
          { text: '❌', callback_data: 'didCancelClick', hide: false },
          { text: '➡️', callback_data: 'didNextClick', hide: this.pageIndex === value.pageCount - 1 },
        ])),
        edit: this._messageToEdit,
        cancelPrevious: true,
        retry: 3,
        didMessageSend: async (message) => { this._messageToEdit = message }
      })

      if (this.isCancelled(selection)) {
        return
      }

      if (!selection) {
        await this.message$('Operation is cancelled')
        return
      }
    })
  }

  @command({ timeout: 5000, resetStates: [ 'searchQuery', 'pageIndex', 'isSearching', '_messageToEdit' ] })
  async * search() {
    if (this.isSearching) { return }
    this.isSearching = false
    this.pageIndex = 1

    const text = yield {
      input: 'What are you looking for?',
      match: /\w.{2,}/,
      matchError: 'Invalid inut'
    }

    this.searchQuery = text

    yield { message: 'Searching…' }
    await this.doSearch(text)
  }

  @action()
  async didPrevClick() {
    --this.searchIndex
    await this.doSearch()
  }

  @action()
  async didNextClick() {
    ++this.searchIndex
    await this.doSearch()
  }

  @action({ emitsEvent: false })
  async didCancelClick() {
    await this.message$('Operation is cancelled')
    if (this._messageToUpdate) {
      await this.context.deleteMessage(this._messageToUpdate!.message_id)
    }

    this.cancelInput()

    this.pageIndex = 1
    this.searchQuery = undefined
    this._messageToUpdate = undefined
    this.isSearching = false
  }
}
```

---
Another example includes an assembly (just add and sub) operating machine
example.

```ts
interface ASMBot extends IBot {}

@bot()
class ASMBot {
  @state() stack: number[] = []

  @command()
  async *asm() {
    yield {
      message: 'Please use `"push $num"` and one of `"add"`, `"sub"`, `"pop"`, `"stop"`',
      // Mark the message as markdown
      extra: Extra.markdown(true)
    }

    while (true) {
      const next = yield {
        input: 'Next:',
        match: /add|sub|pop|stop|(push\s+\d{1,5})/,
        // This will be asked (sending "Next:") if user input was not valid
        keepAsking: true,
        // Expect user to enter this correctly, forever
        retry: Infinity
      }

      switch (next.slice(0, 4).trim()) {
        case 'add': {
          const right = Number(this.stack.pop() ?? '0')
          const left = Number(this.stack.pop() ?? '0')
          this.stack.push(left + right)
          break
        }
        case 'sub': {
          const right = Number(this.stack.pop() ?? '0')
          const left = Number(this.stack.pop() ?? '0')
          this.stack.push(left - right)
          break
        }
        case 'pop': {
          const value = this.stack.pop()
          if (typeof value === 'undefined') {
            yield { message: 'No value found' }
          }
          else {
            yield { message: `${value}` }
          }
          break
        }
        case 'push': {
          const [ , value ] = next.split(' ')
          const num = Number(value)
          this.stack.push(num)
          break
        }
        case 'stop': {
          yield {
            message: `Execution is stopped\nStack:\`\`\`\n\n${JSON.stringify(this.stack, undefined, 1)} \`\`\``,
            extra: Extra.markdown(true)
          }
          return
        }
      }
    }
  }
}

const b = new ASMBot()
b.start()
```

If you want to support to the project:

```md
- Bitcoin     : 153jv3MQVNSvyi2i9UFr9L4ogFyJh2SNt6
- Bitcoin Cash: qqkx22yyjqy4jz9nvzd3wfcvet6yazeaxq2k756hhf
- Ether       : 0xf542BED91d0218D9c195286e660da2275EF8eC84
- Stellar     : GATF6DAKFCYY3MLNAIWVISARP52EWPOPFFZT4JMFENPNPERCMTSDFNY5
```

Thank You.
