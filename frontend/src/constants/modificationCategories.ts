/** Values must match API / contracts (core Modification.category). */

export const MODIFICATION_CATEGORIES = [
  'suspension',
  'engine',
  'electronics',
  'cosmetics',
  'brakes',
  'bodywork',
  'controls',
  'drivetrain',
  'ecu',
  'ergonomics',
  'exhaust',
  'lighting',
  'other',
  'wheels_tires',
] as const;

export type ModificationCategoryValue = (typeof MODIFICATION_CATEGORIES)[number];
