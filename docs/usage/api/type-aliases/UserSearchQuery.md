[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UserSearchQuery

# Type Alias: UserSearchQuery

> **UserSearchQuery** = `object`

Defined in: [src/resources/user.ts:65](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L65)

User Read query. `requestType` 1 = all users (default); `userType` -1 = any (default).

## Properties

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<*typeof* `FIELDS`\>[]

Defined in: [src/resources/user.ts:77](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L77)

Output fields as **bare aliases** (`P_Name`); the library adds the `User.` prefix.
**Omit** to fetch every catalogued field; narrow it when the extra HR fields
(department / telephone / dates) are not interesting. Pass `[]` for PORTERS' own default —
the 4 core fields it returns for a fieldless read.

***

### requestType?

> `optional` **requestType?**: `0` \| `1`

Defined in: [src/resources/user.ts:67](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L67)

1 = all users (default). 0 = the current user (code_direct → the App's own user).

***

### userType?

> `optional` **userType?**: `-1` \| `0` \| `1`

Defined in: [src/resources/user.ts:69](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L69)

-1 = any (default), 0 = system admins, 1 = standard users.
