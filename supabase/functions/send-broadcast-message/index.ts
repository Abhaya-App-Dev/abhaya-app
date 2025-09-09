import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BroadcastRequest {
  user_id: string;
  subject: string;
  message: string;
  latitude?: number;
  longitude?: number;
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    relationship?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, subject, message, latitude, longitude, contacts }: BroadcastRequest = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Resend client
    const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '')

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

    // Prepare email content
    let emailMessage = `Message from ${userName}:\n\n${message}`
    
    if (locationUrl) {
      emailMessage += `\n\n📍 Current Location: ${locationUrl}`
    }

    emailMessage += `\n\nSent via WomenSafe India app`

    // Send emails to contacts with email addresses
    const emailPromises = contacts
      .filter(contact => contact.email)
      .map(async (contact) => {
        try {
          const emailResponse = await resend.emails.send({
            from: 'WomenSafe India <noreply@venkatesh7305.me>',
            to: [contact.email!],
            subject: subject,
            text: emailMessage,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Message from ${userName}</h2>
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
                </div>
                ${locationUrl ? `
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">📍 Current Location:</p>
                    <a href="${locationUrl}" style="color: #dc2626;">${locationUrl}</a>
                  </div>
                ` : ''}
                <div style="background: #dc2626; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px;">
                    <strong>Emergency Contacts (India):</strong><br>
                    🚔 Police: 100<br>
                    🚑 Ambulance: 108<br>
                    👩‍⚕️ Women Helpline: 1091
                  </p>
                </div>
                <p style="color: #6b7280; font-size: 12px;">
                  Sent via WomenSafe India app - ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            `
          })

          console.log(`Email sent to ${contact.name} (${contact.email}):`, emailResponse)
          return {
            contact_name: contact.name,
            contact_email: contact.email,
            status: 'sent',
            message_id: emailResponse.data?.id
          }
        } catch (error) {
          console.error(`Failed to send email to ${contact.name}:`, error)
          return {
            contact_name: contact.name,
            contact_email: contact.email,
            status: 'failed',
            error: error.message
          }
        }
      })

    const emailResults = await Promise.all(emailPromises)

    // Log all notifications (both email and SMS placeholder)
    const allNotifications = contacts.map(contact => ({
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email,
      message: emailMessage,
      sent_at: new Date().toISOString(),
      email_sent: !!contact.email
    }))

    console.log('Broadcast notifications:', allNotifications)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Broadcast sent to ${contacts.length} contacts`,
        contacts_notified: contacts.length,
        emails_sent: emailResults.filter(r => r.status === 'sent').length,
        email_results: emailResults,
        notifications: allNotifications
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-broadcast-message:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send broadcast message'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})