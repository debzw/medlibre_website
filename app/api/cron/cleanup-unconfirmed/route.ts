import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expiredUsers, error } = await supabaseAdmin
    .rpc('get_expired_unconfirmed_users');

  if (error) {
    console.error('[cron/cleanup-unconfirmed] RPC error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!expiredUsers || expiredUsers.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const row of expiredUsers as { user_id: string }[]) {
    try {
      await supabaseAdmin.from('user_profiles').delete().eq('id', row.user_id);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
      if (authError) {
        errors.push(`${row.user_id}: ${authError.message}`);
      } else {
        deleted++;
      }
    } catch (err: unknown) {
      errors.push(`${row.user_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[cron/cleanup-unconfirmed] Deleted ${deleted} users. Errors: ${errors.length}`);

  return NextResponse.json({
    deleted,
    ...(errors.length > 0 && { errors }),
  });
}
