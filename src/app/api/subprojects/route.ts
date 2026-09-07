import { NextRequest, NextResponse } from 'next/server';
import { getSubprojectSnapshot } from '@/lib/subprojects-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // This endpoint returns internal Plane data. Fail closed even when the older
  // page middleware has no SITE_PASSWORD configured.
  const password = process.env.SITE_PASSWORD;
  if (!password || request.cookies.get('site_auth')?.value !== password) {
    return NextResponse.json({ error: 'Sign in to refresh client work.' }, { status: 401 });
  }
  try {
    return NextResponse.json(await getSubprojectSnapshot(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) {
    console.error("Client work refresh failed:", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ error: 'Client work could not refresh. Check the Plane connection and try again.' }, { status: 503 });
  }
}
