// PORTERS' naming rule for custom fields (ADR-0004 / ADR-0098).

/** Custom field aliases are `U_[Name]` (user-created) or `A_[Name]` (app-created). */
export const CUSTOM_ALIAS_PATTERN = /^[UA]_/;
