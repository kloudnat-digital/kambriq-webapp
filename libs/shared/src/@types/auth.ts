export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    roles: string[];
    status: string;
  };
}
