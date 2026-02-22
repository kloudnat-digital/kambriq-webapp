import { BadRequestException, ConflictException } from '@nestjs/common';

// ----- Auth Exceptions ----------
export class InvalidCredentialsException extends BadRequestException {
  constructor(message?: string) {
    super(message);
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor(message?: string) {
    super(message);
  }
}

export class InvalidRefreshTokenException extends BadRequestException {
  constructor(message?: string) {
    super(message);
  }
}
