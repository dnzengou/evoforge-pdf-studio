import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Demoted to warn: shadcn primitives universally mix constant/type
      // exports with component exports; refactoring is out of scope for
      // security-defaults ship. Tracked for v0.3.0.
      'react-refresh/only-export-components': 'warn',
      // Demoted to warn: the flagged patterns (URL-param consumption on
      // mount, matchMedia listener setup) are legitimate useEffect uses.
      // Case-by-case refactor deferred to v0.3.0.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
