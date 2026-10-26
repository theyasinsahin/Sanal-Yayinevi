// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Large accessible lists can take longer to settle on CI/Windows machines.
// Performance regressions use structural budgets rather than this UI wait limit.
configure({ asyncUtilTimeout: 3000 });
