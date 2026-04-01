declare global {
  namespace Express {
    interface User {
      id?: string;
      profileId?: string;
      email?: string;
      role?: string;
      token?: string;
    }
  }
}

export {};
