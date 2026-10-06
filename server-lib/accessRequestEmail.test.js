/**
 * @jest-environment node
 */

const { confirmationEmail, DEMO_URL } = require('./accessRequestEmail');

test('takes no input, so nothing a visitor typed can reach the inbox', () => {
  // The address on a public form is whatever anyone typed. A message that
  // repeated their name or notes would carry a stranger's text.
  expect(confirmationEmail.length).toBe(0);
  expect(confirmationEmail()).toEqual(confirmationEmail());
});

test('points at the demo and says when to expect a reply', () => {
  const { subject, text, html } = confirmationEmail();
  expect(subject).toBe('We got your Tranche request');
  expect(text).toContain('within one business day');
  expect(text).toContain(DEMO_URL);
  expect(html).toContain(DEMO_URL);
});

test('has no em dashes', () => {
  const { subject, text, html } = confirmationEmail();
  expect(`${subject}${text}${html}`).not.toMatch(/—/);
});
