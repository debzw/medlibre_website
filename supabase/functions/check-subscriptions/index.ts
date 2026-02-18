
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

Deno.serve(async (req) => {
    try {
        const now = new Date()
        // 1. DOWNGRADE EXPIRED USERS
        // Find users who are 'paid' BUT their expiry date has passed
        const { data: expiredUsers, error: fetchError } = await supabase
            .from('user_profiles')
            .select('id, tier, tier_expiry')
            .eq('tier', 'paid')
            .lt('tier_expiry', now.toISOString())

        if (fetchError) throw fetchError

        const expiredIds = expiredUsers?.map(u => u.id) || []

        if (expiredIds.length > 0) {
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ tier: 'free' })
                .in('id', expiredIds)

            if (updateError) console.error('Error downgrading users:', updateError)
            else console.log(`Downgraded ${expiredIds.length} users to FREE.`)
        }

        // 2. SEND WARNING EMAILS (7 DAYS BEFORE EXPIRY)
        // Calculate date 7 days from now (approx)
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(now.getDate() + 7)
        // Range: 7 days from now (start of day) to end of day
        const startRange = new Date(sevenDaysFromNow.setHours(0, 0, 0, 0)).toISOString()
        const endRange = new Date(sevenDaysFromNow.setHours(23, 59, 59, 999)).toISOString()

        const { data: warningUsers, error: warningError } = await supabase
            .from('user_profiles')
            .select('id, tier_expiry') // Ideally join with auth.users to get email, but we can't select from auth schema directly easily via client usually unless using rpc or admin client carefully.
            // Actually, service_role client CAN access auth.users via admin api, but not via .from('auth.users').
            // So we will just look for profiles first.
            .eq('tier', 'paid')
            .gte('tier_expiry', startRange)
            .lte('tier_expiry', endRange)

        if (warningUsers && warningUsers.length > 0 && resend) {
            // Need to get emails. We can use supabase.auth.admin.listUsers() but that's pagination heavy.
            // Better: Loop and get user by ID using admin.getUserById
            for (const userProfile of warningUsers) {
                const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userProfile.id)
                if (user && user.email) {
                    try {
                        await resend.emails.send({
                            from: 'MedLibre <noreply@medlibre.com>', // Update this if they verified a domain
                            to: [user.email],
                            subject: 'Seu acesso Premium Beta está acabando!',
                            html: `
                          <h1>Olá!</h1>
                          <p>Esperamos que você esteja aproveitando o MedLibre.</p>
                          <p>Seu acesso Premium gratuito (Beta) expira em 7 dias (em ${new Date(userProfile.tier_expiry).toLocaleDateString()}).</p>
                          <p>Após essa data, sua conta voltará para o plano Gratuito.</p>
                          <br/>
                          <p>Bons estudos!</p>
                        `
                        })
                        console.log(`Email sent to ${user.email}`)
                    } catch (emailError) {
                        console.error(`Failed to send email to ${user.email}`, emailError)
                    }
                }
            }
        } else if (!resend) {
            console.log("Resend API Key missing. Skipping emails.")
        }

        return new Response(JSON.stringify({
            message: 'Check complete',
            downgraded: expiredIds.length,
            warnings_sent: warningUsers?.length || 0
        }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
