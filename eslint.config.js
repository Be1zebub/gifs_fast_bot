import tseslint from "typescript-eslint"

export default tseslint.config(
	{
		ignores: ["node_modules", ".wrangler", "worker-configuration.d.ts"],
	},
	tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{ allowNumber: true, allowBoolean: true },
			],
			"no-console": "off",
		},
	},
)
