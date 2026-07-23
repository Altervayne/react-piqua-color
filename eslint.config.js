import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// The react-hooks `recommended` flat config carries the React Compiler rules,
// including `react-hooks/refs` — the one ColorPicker deliberately opts out of at
// the top of the file for its sticky-ref-during-render pattern.
export default tseslint.config(
   { ignores: ['dist', 'node_modules'] },
   js.configs.recommended,
   ...tseslint.configs.recommended,
   reactHooks.configs.flat['recommended-latest'],
)
