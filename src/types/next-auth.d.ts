import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    isAdmin: boolean;
  }
}

// Note: next-auth/jwt.d.ts only re-exports (`export * from "@auth/core/jwt"`),
// so declaration merging must target "@auth/core/jwt" directly — the module
// where the JWT callback's `token` parameter type actually comes from.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
  }
}
