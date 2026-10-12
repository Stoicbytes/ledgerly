// PREVIEW SEED — weighted daily spending patterns used by seedTransactions.

export type Pick = {
  category: string;
  sub?: string;
  min: number;
  max: number;
  accounts: string[];
  notes?: string[];
};

export const daily: { weight: number; picks: Pick[] }[] = [
  {
    weight: 40,
    picks: [
      {
        category: 'Food',
        sub: 'Tea',
        min: 15,
        max: 40,
        accounts: ['acc-cash'],
        notes: ['Morning tea', 'Tea with team'],
      },
      { category: 'Food', sub: 'Coffee', min: 40, max: 160, accounts: ['acc-card', 'acc-cash'] },
      {
        category: 'Food',
        sub: 'Eating out',
        min: 180,
        max: 650,
        accounts: ['acc-card', 'acc-main'],
        notes: ['Lunch', 'Dinner', 'Team lunch'],
      },
      { category: 'Food', sub: 'Biriyani', min: 180, max: 320, accounts: ['acc-card', 'acc-cash'] },
      { category: 'Food', sub: 'Dosa', min: 60, max: 140, accounts: ['acc-cash'] },
      { category: 'Food', sub: 'Idly', min: 40, max: 90, accounts: ['acc-cash'] },
      { category: 'Food', sub: 'Snacks', min: 30, max: 150, accounts: ['acc-cash'] },
      { category: 'Food', sub: 'Milk', min: 30, max: 60, accounts: ['acc-cash'] },
    ],
  },
  {
    weight: 16,
    picks: [
      { category: 'Transport', sub: 'Bus', min: 20, max: 60, accounts: ['acc-cash'] },
      { category: 'Transport', sub: 'Subway', min: 40, max: 80, accounts: ['acc-card'] },
      { category: 'Transport', sub: 'Taxi', min: 150, max: 450, accounts: ['acc-card'] },
      {
        category: 'Transport',
        sub: 'Petrol',
        min: 300,
        max: 900,
        accounts: ['acc-card', 'acc-main'],
      },
    ],
  },
  {
    weight: 7,
    picks: [
      {
        category: 'Social Life',
        sub: 'Friends outing',
        min: 300,
        max: 1_200,
        accounts: ['acc-card'],
        notes: ['Movie', 'Weekend outing'],
      },
    ],
  },
  {
    weight: 6,
    picks: [
      {
        category: 'Household',
        sub: 'Kitchen',
        min: 200,
        max: 1_400,
        accounts: ['acc-main', 'acc-card'],
        notes: ['Groceries'],
      },
    ],
  },
  {
    weight: 4,
    picks: [
      { category: 'Sports', sub: 'Chennai turf', min: 200, max: 400, accounts: ['acc-main'] },
    ],
  },
  {
    weight: 3,
    picks: [{ category: 'Grooming', sub: 'Haircut', min: 150, max: 300, accounts: ['acc-cash'] }],
  },
  { weight: 4, picks: [{ category: 'Shops', min: 250, max: 2_400, accounts: ['acc-card'] }] },
  {
    weight: 3,
    picks: [
      {
        category: 'Medicine',
        min: 90,
        max: 700,
        accounts: ['acc-main', 'acc-cash'],
        notes: ['Pharmacy'],
      },
    ],
  },
  {
    weight: 2,
    picks: [{ category: 'Stationery', sub: 'Notebook', min: 40, max: 200, accounts: ['acc-cash'] }],
  },
  {
    weight: 2,
    picks: [
      { category: 'Hometown', sub: 'Relatives', min: 300, max: 1_500, accounts: ['acc-main'] },
    ],
  },
  {
    weight: 1,
    picks: [
      { category: 'Gift', min: 500, max: 2_500, accounts: ['acc-card'], notes: ['Birthday gift'] },
    ],
  },
];

export const totalWeight = daily.reduce((sum, group) => sum + group.weight, 0);
