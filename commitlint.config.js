// Conventional Commits を強制（commit-msg フック ＋ CI で検査）。
// 規約の正典は CONTRIBUTING.md / ADR-0013。
export default {
  extends: ["@commitlint/config-conventional"],
  // Dependabot は件名を "Bump …"（大文字始まり）で生成し subject-case に反する。
  // prefix は dependabot.yml の ci / chore(deps) / chore(deps-dev)。これら自動 PR の件名だけ検査から除外する。
  ignores: [(msg) => /^(ci|chore\(deps(-dev)?\)): Bump /.test(msg)],
};
