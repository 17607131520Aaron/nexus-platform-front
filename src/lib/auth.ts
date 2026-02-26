import { cookies } from "next/headers";

const AUTH_TOKEN_KEY = "auth_token";

export async function getServerAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_KEY)?.value ?? null;
}

export async function isAuthenticatedOnServer() {
  const token = await getServerAuthToken();
  return Boolean(token);
}

export { AUTH_TOKEN_KEY };

