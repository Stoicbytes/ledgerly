import type { Note } from '@/lib/domain/notes';

/** Sample notes for the preview (labelled "Preview · not saved"). */
export function seedNotes(now = Date.now()): Note[] {
  const at = (minutesAgo: number) => now - minutesAgo * 60_000;
  const base = { body: '', items: null, archived: false, labels: [] as string[] };
  return [
    {
      ...base,
      id: 'note-sip',
      title: 'Review SIPs',
      body: 'Check fund overlap before increasing the flexi cap SIP. Compare expense ratios.',
      color: 'sage',
      pinned: true,
      labels: ['Finance'],
      createdAt: at(600),
      updatedAt: at(30),
    },
    {
      ...base,
      id: 'note-groceries',
      title: 'Groceries',
      items: [
        { id: 'g1', text: 'Milk', done: true },
        { id: 'g2', text: 'Rice 5 kg', done: false },
        { id: 'g3', text: 'Curry leaves', done: false },
        { id: 'g4', text: 'Coffee powder', done: true },
      ],
      color: 'sand',
      pinned: false,
      labels: ['Home'],
      createdAt: at(300),
      updatedAt: at(45),
    },
    {
      ...base,
      id: 'note-trip',
      title: 'Hometown trip',
      body: 'Book train tickets 60 days ahead.\nCarry gifts for relatives.',
      color: 'fog',
      pinned: false,
      labels: ['Travel'],
      createdAt: at(2_000),
      updatedAt: at(240),
    },
    {
      ...base,
      id: 'note-idea',
      title: '',
      body: 'Insurance renewal is due next month.',
      color: 'default',
      pinned: false,
      labels: ['Finance'],
      createdAt: at(5_000),
      updatedAt: at(1_440),
    },
  ];
}
