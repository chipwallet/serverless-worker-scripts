// src/templates/basic/index.js
import { createClient } from "@supabase/supabase-js";
import renderHtml from "./renderHtml.js";



export default {
  async fetch(request, env) {
    const supabase = createClient(
      env.SUPABASE_URL,  // Use environment variables
      env.SUPABASE_KEY
    );
    if (request.method === 'POST') {
      return handleWebhook(request);
    }

    // Default behavior for other requests
    const html = await renderHtml();
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html"
      }
    });

    async function updateSupabaseStatus(userId, planId, status) {
      const updatedAt = new Date().toISOString();
    
      // Update the subscription table for all records with the same plan_id
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions') // Replace with your subscription table name
        .update({ status, updated_at: updatedAt })
        .eq('plan_id', planId);
    
      // Update the user_accessible_app_id table for all records with the same user_id
      const { error: userAccessibleError } = await supabase
        .from('user_accessible_apps') // Replace with your user accessible app table name
        .update({ status, updated_at: updatedAt })
        .eq('user_id', userId);
    
      if (subscriptionError || userAccessibleError) {
        throw new Error(`Failed to update records: ${subscriptionError?.message || userAccessibleError?.message}`);
      }
    }
    
    async function handleWebhook(request) {
      try {
        const payload = await request.json();
        const eventType = payload.meta.event_name;
        const meta = payload.meta;
        const data = payload.data;
    
        const customData = meta.custom_data || {};
        const userId = customData.user_id;
        const planId = customData.plan_id;
    
        if (eventType === 'subscription_cancelled') {
          await updateSupabaseStatus(userId, planId, 'cancelled');
          return new Response(JSON.stringify({ status: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (eventType === 'subscription_expired') {
          await updateSupabaseStatus(userId, planId, 'inactive');
          return new Response(JSON.stringify({ status: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response('Unknown event type', { status: 400 });
        }
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
  }
};
