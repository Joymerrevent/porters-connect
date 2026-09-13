// lint-staged config (moved out of package.json so the *.md task can be a function).
//
// The function skips two paths for markdownlint, mirroring the `ignores` in the markdownlint-cli2
// config. It has to be repeated here because **lint-staged passes absolute paths**, and those never
// match `ignores`, which are relative globs — so the config's own exclusions are bypassed.
//
//   - `.changeset/*` — a changeset file is frontmatter-first and legitimately has no top-level
//     heading (MD041).
//   - `docs/usage/api/*` — TypeDoc output (ADR-0068). It is inline-link Markdown throughout, which MD054
//     forbids for hand-written docs, and MD041/MD024 also do not fit generated pages. What guards
//     it is `pnpm check:api` (regenerate and fail on a difference), not a style linter.
//
// Prettier needs no equivalent skip: it honours `.prettierignore` even for explicit absolute paths
// (verified), and `docs/usage/api` is listed there. Formatting the generated files would make them differ
// from what `typedoc` emits, so the regeneration gate would fail forever.

const quote = (file) => JSON.stringify(file);
const inDir = (dir) => (file) =>
  file.includes(`/${dir}/`) || file.startsWith(`${dir}/`);
const isChangeset = inDir(".changeset");
const isGeneratedApiDoc = inDir("docs/usage/api");

export default {
  "*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}": ["eslint --fix", "prettier --write"],
  "*.json": ["prettier --write"],
  "*.md": (files) => {
    const lintable = files.filter(
      (file) => !isChangeset(file) && !isGeneratedApiDoc(file),
    );
    const tasks = [];
    if (lintable.length > 0) {
      tasks.push(`markdownlint-cli2 --fix ${lintable.map(quote).join(" ")}`);
    }
    tasks.push(`prettier --write ${files.map(quote).join(" ")}`);
    return tasks;
  },
};
