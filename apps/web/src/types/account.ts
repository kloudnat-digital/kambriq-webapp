export type MeProfile = {
  avatarUrl: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  idVerificationStatus: string;
  idVerifiedAt: string | null;
};

export type Me = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  emailVerified: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
  language: string;
  profile: MeProfile | null;
};

export type AvatarUploadUrl = {
  uploadUrl: string;
  fileUrl: string;
};
