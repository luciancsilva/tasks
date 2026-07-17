module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/frontend'],
  testMatch: [
    '<rootDir>/frontend/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/frontend/**/*.(test|spec).{js,jsx,ts,tsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react'], configFile: false, babelrc: false }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json'],
  transformIgnorePatterns: [
    'node_modules[/\\\\](?!(remark-breaks|mdast-util-newline-to-break|mdast-util-find-and-replace|escape-string-regexp|unist-util-visit-parents|unist-util-is)[/\\\\])'
  ],
  setupFilesAfterEnv: ['<rootDir>/frontend/__tests__/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/frontend/$1'
  },
  collectCoverageFrom: [
    'frontend/**/*.{ts,tsx}',
    '!frontend/**/*.d.ts',
    '!frontend/index.tsx',
    '!frontend/**/__tests__/**',
    '!frontend/**/node_modules/**'
  ],
  coverageDirectory: 'coverage-frontend',
  coverageReporters: ['text', 'lcov', 'html']
};