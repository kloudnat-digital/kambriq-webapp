import { createAvatar } from '@dicebear/core';
import {
  adventurerNeutral,
  bigEarsNeutral,
  botttsNeutral,
  loreleiNeutral,
  notionistsNeutral,
  bigSmile,
} from '@dicebear/collection';

export type TAvatarVariant =
  | 'adventurerNeutral'
  | 'bigEarsNeutral'
  | 'botttsNeutral'
  | 'loreleiNeutral'
  | 'notionistsNeutral'
  | 'bigSmile';

export const generateAvatar = (variant: TAvatarVariant, seed: string): string => {
  switch (variant) {
    case 'adventurerNeutral':
      return createAvatar(adventurerNeutral, { seed }).toDataUri();
    case 'bigEarsNeutral':
      return createAvatar(bigEarsNeutral, { seed }).toDataUri();
    case 'botttsNeutral':
      return createAvatar(botttsNeutral, { seed }).toDataUri();
    case 'loreleiNeutral':
      return createAvatar(loreleiNeutral, { seed }).toDataUri();
    case 'notionistsNeutral':
      return createAvatar(notionistsNeutral, { seed }).toDataUri();
    default:
      return createAvatar(bigSmile, { seed }).toDataUri();
  }
};
