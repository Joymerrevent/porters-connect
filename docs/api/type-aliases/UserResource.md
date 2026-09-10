[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UserResource

# Type Alias: UserResource

> **UserResource** = `object`

Defined in: [src/resources/user.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L87)

## Methods

### current()

> **current**(): `Promise`\<`ReadRecord`\<\{ `P_Department`: `"System[Department]"`; `P_EndDate`: `"Date"`; `P_Id`: `"System[Id]"`; `P_Language`: `"SinglelineText"`; `P_Mail`: `"Mail"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_StartDate`: `"Date"`; `P_Telephone`: `"Telephone"`; `P_TimeZone`: `"SinglelineText"`; `P_Type`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_UserName`: `"SinglelineText"`; \}\> \| `undefined`\>

Defined in: [src/resources/user.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L98)

The current API user (`request_type=0`). Under the library's default `code_direct` auth
this resolves to the App's own user (username = app name) — useful for self-identification.
Under the browser `code` grant it is the logged-in user. Resolves `undefined` if none.

#### Returns

`Promise`\<`ReadRecord`\<\{ `P_Department`: `"System[Department]"`; `P_EndDate`: `"Date"`; `P_Id`: `"System[Id]"`; `P_Language`: `"SinglelineText"`; `P_Mail`: `"Mail"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_StartDate`: `"Date"`; `P_Telephone`: `"Telephone"`; `P_TimeZone`: `"SinglelineText"`; `P_Type`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_UserName`: `"SinglelineText"`; \}\> \| `undefined`\>

***

### search()

> **search**(`query?`): `Promise`\<[`UserPage`](UserPage.md)\>

Defined in: [src/resources/user.ts:88](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L88)

#### Parameters

##### query?

[`UserSearchQuery`](UserSearchQuery.md)

#### Returns

`Promise`\<[`UserPage`](UserPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Department`: `"System[Department]"`; `P_EndDate`: `"Date"`; `P_Id`: `"System[Id]"`; `P_Language`: `"SinglelineText"`; `P_Mail`: `"Mail"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_StartDate`: `"Date"`; `P_Telephone`: `"Telephone"`; `P_TimeZone`: `"SinglelineText"`; `P_Type`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_UserName`: `"SinglelineText"`; \}\>\>

Defined in: [src/resources/user.ts:90](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/user.ts#L90)

Auto-paginating search: yields every matching user.

#### Parameters

##### query?

`Omit`\<[`UserSearchQuery`](UserSearchQuery.md), `"count"` \| `"start"`\>

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Department`: `"System[Department]"`; `P_EndDate`: `"Date"`; `P_Id`: `"System[Id]"`; `P_Language`: `"SinglelineText"`; `P_Mail`: `"Mail"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_StartDate`: `"Date"`; `P_Telephone`: `"Telephone"`; `P_TimeZone`: `"SinglelineText"`; `P_Type`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_UserName`: `"SinglelineText"`; \}\>\>
