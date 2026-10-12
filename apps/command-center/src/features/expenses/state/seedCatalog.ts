import type { Account, Category, CategoryKind } from '@/lib/domain/expenses';

// PREVIEW SEED — sample categories and accounts (see docs/architecture/EXPENSE_MANAGER_FLOW.md).
// Category names follow the owner's existing expense app. "Savings" and
// "Credit card bill" are deliberately absent: they are transfers, not spending.

type Spec = { name: string; icon: string; tint: number; budget?: number; subs?: string[] };

const expenseSpecs: Spec[] = [
  { name: 'Family', icon: 'family', tint: 1, budget: 15_000, subs: ['Monthly expense', 'Parents'] },
  {
    name: 'Food',
    icon: 'food',
    tint: 3,
    budget: 9_000,
    subs: [
      'Eating out',
      'Chocolate',
      'Tea',
      'Coffee',
      'Sandwich',
      'Gobi 65',
      'Snacks',
      'Idly',
      'Biriyani',
      'Veg biriyani',
      'Milk',
      'Puffs',
      'Dosa',
      'Chicken ghee rice',
      'Horlicks',
    ],
  },
  {
    name: 'Social Life',
    icon: 'social',
    tint: 1,
    budget: 3_000,
    subs: ['Friend', 'Friends outing', 'Relatives expense'],
  },
  {
    name: 'Transport',
    icon: 'transport',
    tint: 6,
    budget: 4_000,
    subs: ['Bus', 'Subway', 'Taxi', 'Car', 'Petrol', 'Bike air'],
  },
  {
    name: 'Household',
    icon: 'household',
    tint: 4,
    budget: 3_000,
    subs: ['Appliances', 'Furniture', 'Kitchen', 'Toiletries'],
  },
  {
    name: 'Sports',
    icon: 'sports',
    tint: 0,
    budget: 2_000,
    subs: ['Chennai turf', 'Pondy turf', 'Shuttle cork'],
  },
  {
    name: 'Hometown',
    icon: 'hometown',
    tint: 2,
    subs: ['Relatives', 'Snacks', 'Food', 'Transport', 'Shopping'],
  },
  {
    name: 'Mobile',
    icon: 'mobile',
    tint: 7,
    budget: 1_000,
    subs: ['Jio Recharge', 'Spotify', 'Google subscription'],
  },
  {
    name: 'Grooming',
    icon: 'grooming',
    tint: 5,
    budget: 2_500,
    subs: ['Haircut', 'Clothing', 'Massage', 'Perfume'],
  },
  {
    name: 'Stationery',
    icon: 'stationery',
    tint: 2,
    subs: ['Notebook', 'Pen', 'Sticky notes', 'Print out'],
  },
  { name: 'Shops', icon: 'shops', tint: 5 },
  { name: 'Medicine', icon: 'medicine', tint: 0, budget: 1_500 },
  { name: 'Gadgets', icon: 'gadgets', tint: 7 },
  { name: 'Rent', icon: 'home', tint: 2, budget: 14_000 },
  { name: 'Gift', icon: 'gift', tint: 3 },
];

const incomeSpecs: Spec[] = [
  { name: 'Salary', icon: 'salary', tint: 0 },
  { name: 'Freelance', icon: 'freelance', tint: 2 },
  { name: 'Interest', icon: 'interest', tint: 6 },
  { name: 'Refunds', icon: 'refund', tint: 4 },
];

const slug = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function build(kind: CategoryKind, specs: Spec[]): Category[] {
  return specs.flatMap((spec, order) => {
    const id = `${kind}-${slug(spec.name)}`;
    const parent: Category = {
      id,
      kind,
      parentId: null,
      name: spec.name,
      icon: spec.icon,
      tint: spec.tint,
      budget: spec.budget ? spec.budget * 100 : null,
      order,
    };
    const subs = (spec.subs ?? []).map((name, index): Category => ({
      id: `${id}--${slug(name)}`,
      kind,
      parentId: id,
      name,
      icon: spec.icon,
      tint: spec.tint,
      budget: null,
      order: index,
    }));
    return [parent, ...subs];
  });
}

export const seedCategories = (): Category[] => [
  ...build('expense', expenseSpecs),
  ...build('income', incomeSpecs),
];

export const seedAccounts = (): Account[] => [
  { id: 'acc-cash', name: 'Cash', group: 'cash', openingBalance: 3_500_00, order: 0 },
  { id: 'acc-main', name: 'Main bank', group: 'bank', openingBalance: 1_20_000_00, order: 1 },
  { id: 'acc-salary', name: 'Salary account', group: 'bank', openingBalance: 45_000_00, order: 2 },
  { id: 'acc-card', name: 'Credit card', group: 'card', openingBalance: -8_000_00, order: 3 },
  {
    id: 'acc-sip',
    name: 'Mutual funds (SIP)',
    group: 'investment',
    openingBalance: 2_50_000_00,
    order: 4,
  },
];

/** Category id helpers for the generator. */
export const cat = (kind: CategoryKind, name: string, sub?: string) =>
  `${kind}-${slug(name)}${sub ? `--${slug(sub)}` : ''}`;
