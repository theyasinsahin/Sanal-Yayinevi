import React from 'react';
import { act, render } from '@testing-library/react';
import ParagraphRenderer from './index';
jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: () => ({ data: { getParagraphCommentCounts: [] } }) }));
jest.mock('../ParagraphCommentPanel', () => () => null);
jest.mock('@mui/icons-material', () => Object.fromEntries(['ChatBubbleOutline', 'Bookmark', 'BookmarkBorder'].map(name => [name, () => null])));

beforeEach(() => { jest.useFakeTimers(); Element.prototype.scrollIntoView = jest.fn(); });
afterEach(() => { jest.useRealTimers(); });
const props = { bookId: 'book', chapterId: 'chapter', content: '<p>İlk paragraf</p><p>İkinci paragraf</p><p>Üçüncü paragraf</p>' };

test('a restored bookmark scrolls to its paragraph once after render', () => {
  const view = render(<ParagraphRenderer {...props} restoreParagraphIndex={1} />);
  act(() => jest.runOnlyPendingTimers());
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  expect(Element.prototype.scrollIntoView.mock.instances[0].textContent).toContain('İkinci paragraf');
  view.rerender(<ParagraphRenderer {...props} restoreParagraphIndex={1} />);
  act(() => jest.runOnlyPendingTimers());
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
});

test('an obsolete paragraph index clamps to the last existing paragraph', () => {
  render(<ParagraphRenderer {...props} restoreParagraphIndex={99} />);
  act(() => jest.runOnlyPendingTimers());
  expect(Element.prototype.scrollIntoView.mock.instances[0].textContent).toContain('Üçüncü paragraf');
});

test('ordinary chapter opens do not jump to a bookmark unless restoration is requested', () => {
  render(<ParagraphRenderer {...props} bookmark={{ paragraphIndex: 1 }} />);
  act(() => jest.runOnlyPendingTimers());
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});
