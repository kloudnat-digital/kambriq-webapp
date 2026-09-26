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

export { DOWN_PAYMENT_PERCENT, depositFor } from '../../payments/deposit';
