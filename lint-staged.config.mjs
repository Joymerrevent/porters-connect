// lint-staged config (moved out of package.json so the *.md task can be a function).
// The function skips `.changeset/*` for markdownlint — mirroring the `ignores` in the
// markdownlint-cli2 config — because a changeset file is frontmatter-first and
// legitimately has no top-level heading (MD041). lint-staged passes explicit paths,
// which bypass that `ignores`, so the skip has to live here too. Every other task
// matches the previous package.json config.

const quote = (file) => JSON.stringify(file);
const isChangeset = (file) =>
  file.includes("/.changeset/") || file.startsWith(".changeset/");

export default {
  "*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}": ["eslint --fix", "prettier --write"],
  "*.json": ["prettier --write"],
  "*.md": (files) => {
    const lintable = files.filter((file) => !isChangeset(file));
    const tasks = [];
    if (lintable.length > 0) {
      tasks.push(`markdownlint-cli2 --fix ${lintable.map(quote).join(" ")}`);
    }
    tasks.push(`prettier --write ${files.map(quote).join(" ")}`);
    return tasks;
  },
};
