import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import baseConfig from '../eslint.config.basic.mjs';

export default [
    ...baseConfig(tsParser, tsPlugin),

    {
        files: ['**/*.ts'],
        rules: {
            // Ajoutez ici d'autres règles spécifiques au serveur au besoin
        },
    },

    {
        files: ['**/*.spec.ts'],
        rules: {
            // Usage of magic numbers in tests for simplicity (attributed to a const)
            '@typescript-eslint/no-magic-numbers': 'off'
        }
    },

];