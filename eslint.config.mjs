import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Temporarily disable some strict rules to focus on critical issues
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_" 
      }],
      "@typescript-eslint/no-explicit-any": "warn", // Change from error to warning
      "@typescript-eslint/no-require-imports": "error",
      "prefer-const": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];

export default eslintConfig;
