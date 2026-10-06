// A small, hand-picked commonplace book. One quotation per day.

import { dayOfYear, fromKey } from './dates.js';

export const QUOTES = [
  ['How we spend our days is, of course, how we spend our lives.', 'Annie Dillard, The Writing Life'],
  ['Ohne Hast, aber ohne Rast. — Without haste, but without rest.', 'Johann Wolfgang von Goethe'],
  ['Be patient toward all that is unsolved in your heart and try to love the questions themselves.', 'Rainer Maria Rilke, Letters to a Young Poet'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca, On the Shortness of Life'],
  ['Attention is the rarest and purest form of generosity.', 'Simone Weil'],
  ['Nulla dies sine linea. — No day without a line.', 'after Pliny the Elder'],
  ['Det finnes ikke dårlig vær, bare dårlige klær. — There is no bad weather, only bad clothes.', 'Norwegian saying'],
  ['Festina lente. — Make haste slowly.', 'Augustus, as told by Suetonius'],
  ['Tell me, what is it you plan to do with your one wild and precious life?', 'Mary Oliver, “The Summer Day”'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius, Meditations'],
  ['Lagom är bäst. — Just enough is best.', 'Swedish saying'],
  ['We are what we repeatedly do.', 'Will Durant, after Aristotle'],
  ['Rest is not idleness.', 'John Lubbock, The Use of Life'],
  ['Life can only be understood backwards; but it must be lived forwards.', 'Søren Kierkegaard, Journals'],
  ['Pay attention. Be astonished. Tell about it.', 'Mary Oliver, “Sometimes”'],
  ['While we are postponing, life speeds by.', 'Seneca, Letters to Lucilius'],
  ['It is not enough to be busy. The question is: what are we busy about?', 'Henry David Thoreau'],
  ['Ordnung ist das halbe Leben. — Order is half of life.', 'German saying'],
  ['I am not afraid of storms, for I am learning how to sail my ship.', 'Louisa May Alcott, Little Women'],
  ['Philosophy begins in wonder.', 'Plato, Theaetetus'],
  ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius, Meditations'],
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott'],
  ['Ut sementem feceris, ita metes. — As you sow, so shall you reap.', 'Cicero, De Oratore'],
];

export function quoteFor(key) {
  const i = (dayOfYear(key) + fromKey(key).getFullYear() * 7) % QUOTES.length;
  const [text, by] = QUOTES[i];
  return { text, by };
}
