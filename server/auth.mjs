import { verifyToken } from "@clerk/backend";

function configurationError() {
  const error = new Error("Organizer sign-in is not configured yet. Add the Clerk keys to this Preview deployment in Vercel.");
  error.status = 503;
  return error;
}

export async function getOrganizerUserId(request, environment = process.env) {
  const verification = environment.CLERK_JWT_KEY
    ? { jwtKey: environment.CLERK_JWT_KEY }
    : environment.CLERK_SECRET_KEY
      ? { secretKey: environment.CLERK_SECRET_KEY }
      : null;
  if (!verification) throw configurationError();

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const claims = await verifyToken(token, {
      ...verification,
      authorizedParties: [new URL(request.url).origin],
    });
    return typeof claims.sub === "string" && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}
