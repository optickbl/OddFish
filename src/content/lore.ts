/** The Captain's Log: a slow mystery, one page at a time. */
export interface LogPage { title: string; text: string }

export const LOG_PAGES: LogPage[] = [
  { title: 'New crew', text: 'New crew today. Looks soft. Told them the one rule: the sea is bored of the obvious. Shout what everyone shouts and you get sardines. Say the thing nobody says and the water notices.' },
  { title: 'Ticking', text: 'Something under the hull ticked all night. Not a fish. Fish don’t tick. Logged it and went back to sleep. I’m a cat. I sleep.' },
  { title: 'Odd Water', text: 'The old charts mark a patch past the reef as “Odd Water”. No depth. No soundings. Just a drawing of an eye. Very professional, whoever made these.' },
  { title: 'The gull', text: 'Gull at the harbour says Leviathans aren’t caught, they choose who catches them. Gull owes me three sardines. I don’t trust the gull. Writing it down anyway.' },
  { title: 'A bottle', text: 'Hauled up a bottle. Note inside: “It listens for the answer nobody gives.” The handwriting looks like mine. I don’t remember writing it. I’m keeping the bottle.' },
  { title: 'Lights', text: 'Lights under the boat tonight, in rows, like letters. They spelled a word. I won’t say which. The crew would only argue about whether it counts.' },
  { title: 'The deep keeps count', text: 'Worked it out. The bigger the crew’s total haul, the stranger the things that come up. The deep keeps count of every kilo. Something down there is paying attention.' },
  { title: 'Grandfather', text: 'My grandfather sailed this water. Same hat. He spent his last season chasing a fish nobody had ever landed. The Oddfish, he called it. Everyone laughed. He didn’t come back.' },
  { title: 'Midnight', text: 'The ticking is a clock. Every midnight, UTC, something below turns the questions over like stones. Fresh ones by morning. Same seven for everyone on the sea.' },
  { title: 'The shape', text: 'A shape passed under us. Longer than the boat. Slower than anything that size should be. It circled once, as if reading the crew’s answers, then went back down.' },
  { title: 'Never, not rare', text: 'Grandfather’s mistake: he went looking for rare answers. The Oddfish doesn’t want rare. It wants never. An answer no angler on this sea has ever given.' },
  { title: 'Captain’s orders', text: 'Crew’s nearly ready. I’ve stopped being grumpy about them. Mostly. Keep casting. When it rises, I want to be on deck with my hat on. That’s an order.' },
];

/** A new page every few Daily Casts. */
export const CASTS_PER_PAGE = 3;
