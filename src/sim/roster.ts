// The house roster: fictional fighters the simulation throws into the pit.
// None of these are real tokens.

export interface RosterEntry {
  name: string;
  ticker: string;
  bio: string;
}

export const ROSTER: RosterEntry[] = [
  { name: 'Unpaid Intern', ticker: 'INTERN', bio: 'Works for exposure. Fights for rent.' },
  { name: 'Forklift Certified', ticker: 'FORKLIFT', bio: 'Licensed to lift. Not licensed to lose.' },
  { name: 'Grandma’s Wifi', ticker: 'WIFI', bio: 'Password is on the fridge. Signal is not.' },
  { name: 'Parking Ticket', ticker: 'TICKET', bio: 'Shows up uninvited. Always collects.' },
  { name: 'Reply Guy', ticker: 'REPLY', bio: 'First under every post. First into every fight.' },
  { name: 'Wet Socks', ticker: 'SOCKS', bio: 'Nobody wants it. Nobody escapes it.' },
  { name: 'Group Project', ticker: 'GROUP', bio: 'One member does all the work. It’s this one.' },
  { name: '4am Kebab', ticker: 'KEBAB', bio: 'Terrible decision. Undefeated at closing time.' },
  { name: 'Wrong Bus', ticker: 'BUS', bio: 'Took you somewhere. Not where you asked.' },
  { name: 'Printer Jam', ticker: 'JAM', bio: 'PC LOAD LETTER. Swings anyway.' },
  { name: 'Office Microwave Fish', ticker: 'FISH', bio: 'Clears the room in one round.' },
  { name: 'Hotel Minibar', ticker: 'MINIBAR', bio: 'Tiny bottles. Enormous invoice.' },
  { name: 'Low Battery', ticker: 'LOWBAT', bio: '1% and still talking.' },
  { name: 'Reply All', ticker: 'REPLYALL', bio: 'Hits everyone at once. Apologises to no one.' },
  { name: 'Cold Fries', ticker: 'FRIES', bio: 'Forgotten at the bottom of the bag. Still hungry.' },
  { name: 'Terms & Conditions', ticker: 'TERMS', bio: 'You agreed to this fight without reading it.' },
  { name: 'Out Of Office', ticker: 'OOO', bio: 'Back Monday. Throwing hands today.' },
  { name: 'Rent Due', ticker: 'RENTDUE', bio: 'Arrives on the first. Every single month.' },
  { name: 'Unused Gym Membership', ticker: 'GYM', bio: 'Paid in full. Never trained. Dangerous.' },
  { name: 'Pigeon Syndicate', ticker: 'COO', bio: 'Controls every bench in the city.' },
  { name: 'Goblin Mode', ticker: 'GOBLIN', bio: 'Unshowered. Unbothered. Unbeaten.' },
  { name: 'Toll Booth', ticker: 'TOLL', bio: 'You don’t get past without paying.' },
  { name: 'Hold Music', ticker: 'HOLD', bio: 'Your call is important. Your chin is not.' },
  { name: 'Crypto Uncle', ticker: 'UNCLE', bio: 'Brought it up at dinner. Again.' },
  { name: 'Seat Recliner', ticker: 'RECLINE', bio: 'Leans all the way back on takeoff.' },
  { name: 'Lost Airpod', ticker: 'LEFTPOD', bio: 'Only the left one survived.' },
  { name: 'Self Checkout', ticker: 'BAGGING', bio: 'Unexpected item in the bagging area.' },
  { name: 'Landlord Special', ticker: 'GREYPAINT', bio: 'Painted over everything, including the problem.' },
  { name: 'Captcha Fail', ticker: 'NOTROBOT', bio: 'Clicked every bus. Still not a human.' },
  { name: 'Sunday Scaries', ticker: 'SCARY', bio: 'Arrives at 6pm. Stays until Monday.' },
  { name: 'Burnt Toast', ticker: 'TOAST', bio: 'Scraped once. Still smoking.' },
  { name: 'Airport Carpet', ticker: 'CARPET', bio: 'Seen every delay in history.' },
  { name: 'Dead Houseplant', ticker: 'FERN', bio: 'Watered once in March. Refuses to die.' },
  { name: 'Mute Button', ticker: 'MUTED', bio: 'You’re on mute. It still heard you.' },
  { name: 'Loose Shopping Cart', ticker: 'CART', bio: 'One wobbly wheel. Zero brakes.' },
  { name: 'Group Chat Admin', ticker: 'ADMIN', bio: 'Removed you for less.' },
];

export const TRASH_TALK = [
  'is swinging wild',
  'just landed a clean jab',
  'found a second wind',
  'is on the ropes',
  'has the crowd on its feet',
  'is dancing around the ring',
  'took one to the chin',
  'is breathing heavy',
];
