import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IndividualMessageRequest {
  user_id: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    relationship?: string;
  };
  subject: string;
  message: string;
  latitude?: number;
  longitude?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, contact, subject, message, latitude, longitude }: IndividualMessageRequest = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Resend client (only if contact has email)
    let resend;
    if (contact.email) {
      resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '')
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user_id)
      .single()

    const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'User'
    
    // Create location URL if coordinates are provided
    const locationUrl = latitude && longitude 
      ? `https://maps.google.com/maps?q=${latitude},${longitude}`
      : null

    // Prepare message content
    let finalMessage = `Message from ${userName}:\n\n${message}`
    
    if (locationUrl) {
      finalMessage += `\n\n📍 Current Location: ${locationUrl}`
    }

    finalMessage += `\n\nSent via WomenSafe India app`

    let emailResult = null;

    // Send email if contact has email address
    if (contact.email && resend) {
      try {
        const emailResponse = await resend.emails.send({
          from: 'WomenSafe India <noreply@venkatesh7305.me>',
          to: [contact.email],
          subject: subject,
          text: finalMessage,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Personal Message from ${userName}</h2>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
              </div>
              ${locationUrl ? `
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold;">📍 Current Location:</p>
                  <a href="${locationUrl}" style="color: #dc2626;">${locationUrl}</a>
                </div>
              ` : ''}
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #374151;">
                  <strong>Emergency Contacts (India):</strong><br>
                  🚔 Police: 100 | 🚑 Ambulance: 108 | 👩‍⚕️ Women Helpline: 1091
                </p>
              </div>
              <p style="color: #6b7280; font-size: 12px;">
                Sent via WomenSafe India app - ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          `
        })

        console.log(`Email sent to ${contact.name} (${contact.email}):`, emailResponse)
        emailResult = {
          status: 'sent',
          message_id: emailResponse.data?.id
        }
      } catch (error) {
        console.error(`Failed to send email to ${contact.name}:`, error)
        emailResult = {
          status: 'failed',
          error: error.message
        }
      }
    }

    // Log notification details
    const notification = {
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email,
      message: finalMessage,
      sent_at: new Date().toISOString(),
      email_sent: !!contact.email
    }

    console.log('Individual message notification:', notification)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Message sent to ${contact.name}`,
        contact_notified: contact.name,
        email_result: emailResult,
        notification: notification
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-individual-message:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send individual message'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})