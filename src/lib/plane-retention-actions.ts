'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from './supabase-server';
import { PLANE_HOME, PLANE_WORKSPACE } from './subprojects';

export async function retainIssueInPlane(id: number, planeUrl: string) {
  const password = process.env.SITE_PASSWORD;
  if (!password || cookies().get('site_auth')?.value !== password) throw new Error('Sign in before changing the board.');
  const key = process.env.PLANE_API_KEY;
  if (!key) throw new Error('Connect Plane before removing this issue from the board.');
  let url: URL;
  try { url = new URL(planeUrl); } catch { throw new Error('Paste the link to the existing Plane work item.'); }
  const match = url.pathname.match(/^\/project-ares\/projects\/([a-f0-9-]{36})\/(?:work-items|issues)\/([a-f0-9-]{36})\/?$/i);
  if (url.origin !== 'https://app.plane.so' || !match) throw new Error('Use a work-item link from the AgencyOS Plane workspace.');
  const response = await fetch(`https://api.plane.so/api/v1/workspaces/${PLANE_WORKSPACE}/projects/${match[1]}/work-items/${match[2]}/?expand=state`, {
    headers: { 'X-API-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Could not verify that work item in Plane. The board is unchanged.');
  const item = await response.json();
  if (!['backlog', 'completed', 'cancelled'].includes(item.state?.group)) {
    throw new Error('This work is still active in Plane. Keep current blockers here; only backlog or closed work can be removed.');
  }
  const supabase = createClient();
  const { data: issue, error: readError } = await supabase.from('ids_items').select('discuss,archived').eq('id', id).single();
  if (readError || !issue) throw new Error('Could not read this issue.');
  if (issue.archived) return;
  const canonicalUrl = `${PLANE_HOME}projects/${match[1]}/work-items/${match[2]}/`;
  const { error } = await supabase.from('ids_items').update({
    archived: true,
    // Moving out of the meeting agenda does not claim the work was completed.
    completed_at: null,
    discuss: [issue.discuss, `Retained in Plane: ${canonicalUrl}`].filter(Boolean).join('\n\n')
  }).eq('id', id).eq('archived', false);
  if (error) throw new Error('Could not update the board. Please try again.');
  revalidatePath('/weekly');
}
