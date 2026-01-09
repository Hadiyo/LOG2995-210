import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import baseConfig from '../eslint.config.basic.mjs';

export default [
    ...baseConfig(tsParser, tsPlugin),
    {
        files: ['**/*.ts'],
        plugins: {
            '@angular-eslint': angular,
        },
        rules: {
            // Angular rules
            '@angular-eslint/directive-selector': [
                'error',
                {
                    type: 'attribute',
                    prefix: 'app',
                    style: 'camelCase',
                },
            ],
            '@angular-eslint/component-selector': [
                'error',
                {
                    type: 'element',
                    prefix: 'app',
                    style: 'kebab-case',
                },
            ],
            '@angular-eslint/use-lifecycle-interface': 'error',
            '@angular-eslint/no-input-rename': 'error',
        },
    },
    {
        files: ['**/*.html'],
        languageOptions: {
            parser: templateParser,
        },
        plugins: {
            '@angular-eslint/template': angularTemplate,
        },
        rules: {
            // Angular template rules can be added here
        },
    },
];
