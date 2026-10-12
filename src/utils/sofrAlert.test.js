import { sofrMoveSinceLastSession } from './sofrAlert';

test('first visit: nothing to compare', () => {
  expect(sofrMoveSinceLastSession(null, 0.0387)).toBeNull();
});

test('a move over 25 bps returns the previous rate', () => {
  expect(sofrMoveSinceLastSession('0.0420', 0.0387)).toBe(0.042);
});

test('a move of 25 bps or less shows nothing', () => {
  expect(sofrMoveSinceLastSession('0.0400', 0.0387)).toBeNull();
});

test('the stored 4.25% placeholder never triggers the banner', () => {
  expect(sofrMoveSinceLastSession('0.0425', 0.0387)).toBeNull();
});

test('garbage in storage shows nothing', () => {
  expect(sofrMoveSinceLastSession('abc', 0.0387)).toBeNull();
});
