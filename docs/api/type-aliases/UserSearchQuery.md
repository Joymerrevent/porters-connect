[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UserSearchQuery

# Type Alias: UserSearchQuery

> **UserSearchQuery** = `object`

Defined in: [src/resources/user.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L71)

User Read query. `requestType` 1 = all users (default); `userType` -1 = any (default).

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/user.ts:83](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L83)

***

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<*typeof* `FIELDS`\>[]

Defined in: [src/resources/user.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L82)

Output fields as **bare aliases** (`P_Name`); the library adds the `User.` prefix (ADR-0059).
**Omit** to fetch every catalogued field (ADR-0020); narrow it when the extra HR fields
(department / telephone / dates) are not interesting. Pass `[]` for PORTERS' own default —
the 4 core fields it returns for a fieldless read.

***

### requestType?

> `optional` **requestType?**: `0` \| `1`

Defined in: [src/resources/user.ts:73](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L73)

1 = all users (default). 0 = the current user (code_direct → the App's own user).

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/user.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L84)

***

### userType?

> `optional` **userType?**: `-1` \| `0` \| `1`

Defined in: [src/resources/user.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L75)

-1 = any (default), 0 = system admins, 1 = standard users.
