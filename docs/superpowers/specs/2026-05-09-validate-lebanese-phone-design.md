# validateLebanesePhoneNumber — Design

**Date:** 2026-05-09
**Status:** Approved

## Goal

Build `validateLebanesePhoneNumber(input: string): boolean` that returns `true` for valid Lebanese mobile and landline numbers and `false` otherwise. Ship it as a Node ESM project with a test suite using the built-in `node:test` runner.

## Validation Rules

### Mobile prefixes (8 digits total in local format)
`03, 70, 71, 76, 78, 79, 81` — each followed by 6 digits.

### Landline prefixes (7 digits total in local format)
`01, 02, 04, 05, 06, 07, 08, 09` — each followed by 5 digits. (`03` is excluded; it is mobile.)

### Country code (optional)
- `+961` or `00961` accepted.
- **Strict convention:** when a country code is present, the leading `0` of the local prefix is dropped. Examples:
  - Valid: `+961 3 123456`, `+961 70 123456`, `00961 1 234567`
  - Invalid: `+961 03 123456`, `00961 03 123456`

### Separators (optional)
Whitespace (spaces, tabs), dashes (`-`), and parentheses (`(`, `)`) may appear anywhere and are ignored. No other separators are allowed (no dots, slashes, etc.).

### Input guard
Non-string input (including `null`, `undefined`, numbers, objects) returns `false`. Empty string returns `false`.

## Algorithm

```
1. If typeof input !== "string" || input === "": return false
2. Strip allowed separators: whitespace, dashes, parentheses
3. If the stripped string does not match /^\+?\d+$/: return false
4. If it starts with "00961", replace that prefix with "+961"
5. If it starts with "+961":
     remainder = string after "+961"
     if remainder starts with "0": return false   (strict country-code rule)
   Else:
     if string does not start with "0": return false
     remainder = string after the leading "0"
6. Test remainder against:
     mobile:   /^(3|70|71|76|78|79|81)\d{6}$/
     landline: /^(1|2|4|5|6|7|8|9)\d{5}$/
   Return true if either matches; false otherwise.
```

## Project Structure

```
package.json                                  // "type": "module", scripts.test = "node --test"
src/validateLebanesePhoneNumber.js            // exports default function
test/validateLebanesePhoneNumber.test.js      // node:test + node:assert
.gitignore                                    // node_modules
```

No external dependencies. Node 18+ assumed (built-in test runner).

## Public API

```js
import validateLebanesePhoneNumber from "./src/validateLebanesePhoneNumber.js";

validateLebanesePhoneNumber("03-123-456");        // true
validateLebanesePhoneNumber("+961 70 123 456");   // true
validateLebanesePhoneNumber("00961 1 234567");    // true
validateLebanesePhoneNumber("+961 03 123456");    // false (strict)
validateLebanesePhoneNumber("75123456");          // false (invalid mobile prefix)
validateLebanesePhoneNumber("");                  // false
validateLebanesePhoneNumber(null);                // false
```

The function returns only a boolean. No formatting, no part extraction, no mobile-vs-landline distinction in the return value.

## Test Plan

Tests are organized by category using `describe`/`it`.

**Valid mobile, local format** — one case per prefix (03, 70, 71, 76, 78, 79, 81).

**Valid landline, local format** — one case per prefix (01, 02, 04, 05, 06, 07, 08, 09).

**Valid with separators** — dashes, spaces, parentheses, and mixed combinations applied to both mobile and landline numbers.

**Valid with country code** — `+961` and `00961` variants, applied to mobile and landline, with and without separators between the country code and the local part.

**Invalid input types** — `null`, `undefined`, number, object, array, empty string.

**Invalid prefixes** — `00`, `10`, `75` (mobile-like but not in the list), `83`.

**Invalid lengths** — mobile too short, mobile too long, landline too short, landline too long.

**Invalid characters** — letters, dots, slashes, emoji.

**Invalid country-code combinations** — `+961` followed by `0`, `00961` followed by `0`.

**Local format without leading 0** — e.g., `3123456` (would be valid only with country code).

**Edge cases** — leading/trailing whitespace, multiple consecutive separators, separators at the start/end.

## Non-Goals

- Formatting or normalizing output.
- Extracting prefix, country code, or subscriber number.
- Returning the type (mobile/landline) of the number.
- Validating other countries.
- Supporting alternative separators (dots, slashes) or extension syntax.
