/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'api',
        'mobile',
        'iot',
        'db',
        'shared',
        'infra',
        'ci',
        'deps',
        'deps-web',
        'deps-api',
      ],
    ],
    'scope-empty': [1, 'never'], // Warn (not error) when scope is missing
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
};
