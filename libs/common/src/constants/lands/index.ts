import {
  LandLabelCodes,
  LandDocumentType,
  LandMediaType,
  LandOwnerType,
  LandReservationStatus,
  LandClientDocumentType,
  LandStatus,
} from '../../prisma/lands-client/enums';

export {
  LandLabelCodes,
  LandDocumentType,
  LandMediaType,
  LandOwnerType,
  LandReservationStatus,
  LandStatus,
  LandClientDocumentType,
};

export enum LandMediaCategory {
  MEDIA = 'MEDIA',
  DOCUMENT = 'DOCUMENT',
}

export const DOWN_PAYMENT_PERCENT = 5 as const; // 5% of land price
