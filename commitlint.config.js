// Conventional Commits を強制（commit-msg フック ＋ CI で検査）。
// 規約の正典は CONTRIBUTING.md / ADR-0013。
export default {
  extends: ["@commitlint/config-conventional"],
};
