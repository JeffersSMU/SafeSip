// Cast and contacts from docs/Iter1.3 Requirements.docx (DESIGN §1.1).

export interface Person {
  id: string;
  name: string;
  short: string;
  phone: string;
  color: string;
  initials: string;
}

export const CHLOE: Person = {
  id: 'chloe',
  name: 'Chloe Tan',
  short: 'Chloe',
  phone: '+65 9234 1447',
  color: '#5B3DF5',
  initials: 'CT',
};

export const HELEN: Person = {
  id: 'helen',
  name: 'Helen Lim',
  short: 'Helen',
  phone: '+65 9876 5432',
  color: '#0E7490',
  initials: 'HL',
};

export const SARAH: Person = {
  id: 'sarah',
  name: 'Sarah Loh',
  short: 'Sarah',
  phone: '+65 9123 8806',
  color: '#DB2777',
  initials: 'SL',
};

/** SafeSip contacts of Chloe (all have the app; B5 note). Sarah is Recent + Favourite. */
export const CONTACTS: (Person & { recent?: boolean; favourite?: boolean })[] = [
  { ...SARAH, recent: true, favourite: true },
  { id: 'alex', name: 'Alex Reed', short: 'Alex', phone: '+65 9001 2231', color: '#EA580C', initials: 'AR', recent: true },
  { id: 'dave', name: 'Dave Williams', short: 'Dave', phone: '+65 9001 4412', color: '#2563EB', initials: 'DW' },
  { id: 'travis', name: 'Travis Sock', short: 'Travis', phone: '+65 9001 5590', color: '#7C3AED', initials: 'TS', favourite: true },
  { id: 'sam', name: 'Sam Torres', short: 'Sam', phone: '+65 9001 7781', color: '#059669', initials: 'ST' },
  { id: 'cass', name: 'Cass Murphy', short: 'Cass', phone: '+65 9001 8820', color: '#B45309', initials: 'CM' },
];

export const personById = (id: string): Person =>
  [CHLOE, HELEN, ...CONTACTS].find((p) => p.id === id) ?? { ...SARAH, id, name: id, short: id };

/** Next-of-Kin of Chloe; linked to Helen's Watcher account by matching phone number (A14 / §4.2). */
export const NEXT_OF_KIN = [{ personId: 'helen', relationship: 'Mother' }];

/**
 * Users linked to the Watcher. Chloe is Helen's only child (confirmed). The optional demo child is
 * static data that only exists to exercise the multi-child switcher; it is off by default.
 */
export const DEMO_EXTRA_CHILD: Person & { relationship: string } = {
  id: 'ethan',
  name: 'Ethan Tan',
  short: 'Ethan',
  phone: '+65 9234 7781',
  color: '#0891B2',
  initials: 'ET',
  relationship: 'Son',
};

export const LINKED_RELATIONSHIP: Record<string, string> = { chloe: 'Daughter', ethan: 'Son' };
