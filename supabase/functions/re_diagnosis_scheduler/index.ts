// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// 6 months ~ 12 months in milliseconds (approximate)
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TWELVE_MONTHS_MS = 12 * 30 * 24 * 60 * 60 * 1000;

serve(async (req) => {
  try {
    // This function can be triggered via a cron job (pg_cron or Supabase scheduled functions)
    // or manually via a webhook.
    
    // Create a Supabase client with the Auth context of the function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const now = new Date();

    // Query facilities whose last_survey_date is between 6 to 12 months ago
    // For a production system, we'd use PostgreSQL dates, but since we are in Deno:
    const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS).toISOString();
    const twelveMonthsAgo = new Date(now.getTime() - TWELVE_MONTHS_MS).toISOString();

    const { data: facilities, error: fetchError } = await supabase
      .from('facilities')
      .select('id, name, last_survey_date')
      .lte('last_survey_date', sixMonthsAgo)
      .gte('last_survey_date', twelveMonthsAgo)
      .eq('status', '공개');

    if (fetchError) throw fetchError;

    if (!facilities || facilities.length === 0) {
      return new Response(
        JSON.stringify({ message: "No facilities require re-diagnosis at this time." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Filter out facilities that already have a pending or recent re-diagnosis log
    // to prevent spamming notifications.
    const { data: existingLogs, error: logsError } = await supabase
      .from('re_diagnosis_logs')
      .select('facility_id')
      .in('facility_id', facilities.map(f => f.id))
      .in('status', ['예정', '완료']);

    if (logsError) throw logsError;

    const existingLogFacilityIds = new Set(existingLogs?.map(l => l.facility_id));
    
    const facilitiesToLog = facilities.filter(f => !existingLogFacilityIds.has(f.id));

    if (facilitiesToLog.length === 0) {
      return new Response(
        JSON.stringify({ message: "All eligible facilities already have re-diagnosis logs." }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Prepare records for insertion
    const recordsToInsert = facilitiesToLog.map(f => ({
      facility_id: f.id,
      trigger_type: '자동',
      status: '예정',
      scheduled_for: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() // Scheduled 2 weeks from now
    }));

    // Insert into re_diagnosis_logs
    const { error: insertError } = await supabase
      .from('re_diagnosis_logs')
      .insert(recordsToInsert);

    if (insertError) throw insertError;

    // TODO: Send Email/Slack notification here for the facilitiesToLog.
    console.log(`[Notification] Generated re-diagnosis tasks for ${facilitiesToLog.length} facilities.`);

    return new Response(
      JSON.stringify({ 
        message: `Successfully scheduled re-diagnosis for ${facilitiesToLog.length} facilities.`,
        facilities: facilitiesToLog.map(f => f.name)
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
