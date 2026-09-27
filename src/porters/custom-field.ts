// PORTERS' naming rule for custom fields (ADR-0004 / ADR-0098).

// [Name] に使える文字は reference に書かれていない。だから狭めず、`field` / `condition` の書き方を壊す文字
// （区切りの `,` `:` `=`、接頭辞の `.`、展開の `(` `)`、空白）と、空の名前だけを拒否する。`"U_a,Person.P_Memo"`
// を `field` に入れると、別の標準項目を要求していた（RV-112）。
/** Custom field aliases are `U_[Name]` (user-created) or `A_[Name]` (app-created). */
export const CUSTOM_ALIAS_PATTERN = /^[UA]_[^\s,:=.()]+$/;

// Field Read の行からカスタム項目を見分ける用。見分けるだけなので狭めない（変わった文字の alias を黙って
// 読み飛ばさない。宣言にすると CUSTOM_ALIAS_PATTERN の検査で止まり、利用者に見える）。
/** The prefix that marks a custom field alias (`U_` / `A_`). */
export const CUSTOM_ALIAS_PREFIX = /^[UA]_/;
