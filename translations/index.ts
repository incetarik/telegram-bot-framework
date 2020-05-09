const translations: { [lang: string]: { [key: string]: string } } = {}

/**
 * Translates a given key in given language.
 *
 * @export
 * @template TSource Source of the translation set.
 * @template TLangs Available language types.
 * @param {keyof TSource} key Key of the translation set.
 * @param {TLangs} lang Language to translate.
 * @param {string} [defaultValue] Default value if the key is not found.
 * @returns The translation value or default value.
 */
export function _<TSource = any, TLangs extends string = string>(key: keyof TSource, lang: TLangs, defaultValue?: string): string | undefined {
  if (!key) { return defaultValue }
  if (lang in translations) {
    const tr = translations[ lang ]
    if (key in tr) {
      //@ts-ignore
      return tr[ key ]
    }
  }

  return defaultValue
}

/**
 * Registers a language to the translation set.
 *
 * Note that this function will check nothing if the language was existing.
 *
 * @export
 * @template TSource Source of the any language translation set.
 * @param {string} lang Language short-code to register.
 * @param {TSource} content The content of the language translation set.
 * @param {boolean} [keyCheck=false] Indicates whether the keys should be check
 * to ensure all of the mappins have the same keys.
 *
 * @returns {boolean} `true` if the language is newly registered.
 * `false` if the language was existing already and updated.
 *
 * @throws {Error} If the `keyCheck` is `true` and there are missing or more
 * keys.
 */
export function registerLanguage<TSource = any>(lang: string, content: TSource, keyCheck = false): boolean {
  if (lang in translations) {
    //@ts-ignore
    translations[ lang ] = content
    return false
  }
  else {
    if (keyCheck) {
      const keys = Object.keys(translations)
      if (keys.length > 0) {
        const anyValue = translations[ keys[ 0 ] ]
        if (typeof anyValue === 'object') {
          const keysToCheck = Object.keys(anyValue)
          for (let i = keysToCheck.length - 1; i >= 0; --i) {
            const key = keysToCheck[ i ]
            if (key in content) {
              keysToCheck.splice(i, 1)
            }
            else {
              throw new Error(`Unexpected key found for translation: ${key}`)
            }
          }

          if (keysToCheck.length > 0) {
            throw new Error(`Missing keys for translation: ${keysToCheck.join(', ')}`)
          }
        }
      }
    }

    //@ts-ignore
    translations[ lang ] = content
    return true
  }
}
