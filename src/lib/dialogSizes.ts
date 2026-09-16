// Shared width scale for DialogContent — replaces 8 one-off max-w values
// scattered across the app's ~12 create/edit dialogs with 4 named sizes.
export const DIALOG_SIZES = {
  sm: 'sm:max-w-[480px]',
  md: 'sm:max-w-[600px]',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export type DialogSize = keyof typeof DIALOG_SIZES;
