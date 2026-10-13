// @ts-check
/*
Errors with a text that depends on the language of the interface.

The calculation does not know the language. It throws a TextError with
the key of the text and its parameters; the interface looks the text up
in the table of the chosen language (i18n.js).
*/

/**
 * A message as a key with parameters.
 * @typedef {Object} TextMessage
 * @property {string} key  key of the text in i18n.js
 * @property {Object<string, any>} [params]  values for the {names} in the text
 */

export class TextError extends Error {
    /**
     * @param {string} key  key of the text in i18n.js
     * @param {Object<string, any>} [params]  values for the {names} in the text
     */
    constructor(key, params = {}) {
        // without a table of texts the key itself is the message
        super(key);
        this.name = 'TextError';
        this.key = key;
        this.params = params;
    }
}
