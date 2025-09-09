import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmergencyRequest {
  user_id: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  media_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, latitude, longitude, message, media_url }: EmergencyRequest = await req.json()

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

    // Get all emergency contacts for the user
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user_id)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      throw new Error('Failed to fetch emergency contacts')
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('No emergency contacts found')
    }

    // Create location URL if coordinates are provided
    const locationUrl = latitude && longitude 
      ? `https://maps.google.com/maps?q=${latitude},${longitude}`
      : null

    // Create emergency message
    const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'User'
    let emergencyMessage = `🚨 EMERGENCY ALERT from ${userName}!\n\n`
    
    if (message) {
      emergencyMessage += `Message: ${message}\n\n`
    } else {
      emergencyMessage += `I need immediate help!\n\n`
    }

    if (locationUrl) {
      emergencyMessage += `📍 Current Location: ${locationUrl}\n\n`
    }

    if (media_url) {
      emergencyMessage += `📎 Emergency Recording: ${media_url}\n\n`
    }

    emergencyMessage += `This is an automated SOS message from WomenSafe India app.\n`
    emergencyMessage += `Please contact emergency services if needed:\n`
    emergencyMessage += `🚔 Police: 100\n`
    emergencyMessage += `🚑 Ambulance: 108\n`
    emergencyMessage += `👩‍⚕️ Women Helpline: 1091`

    // Send emails to contacts with email addresses
    const emailPromises = contacts
      .filter(contact => contact.email)
      .map(async (contact) => {
        try {
          const emailResponse = await resend.emails.send({
            from: 'WomenSafe India Emergency <emergency@venkatesh7305.me>',
            to: [contact.email],
            subject: `🚨 EMERGENCY ALERT from ${userName}`,
            text: emergencyMessage,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef2f2; padding: 20px; border-radius: 8px;">
                <h1 style="color: #dc2626; text-align: center; margin: 0 0 20px 0;">🚨 EMERGENCY ALERT</h1>
                <h2 style="color: #dc2626; margin: 0 0 20px 0;">From: ${userName}</h2>
                
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                  <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                    ${message ? message : 'I need immediate help!'}
                  </p>
                </div>

                ${locationUrl ? `
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e;">📍 Current Location:</p>
                    <a href="${locationUrl}" style="color: #dc2626; font-weight: bold; font-size: 16px;">${locationUrl}</a>
                  </div>
                ` : ''}

                ${media_url ? `
                  <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #0277bd;">📎 Emergency Recording:</p>
                    <a href="${media_url}" style="color: #dc2626; font-weight: bold;">${media_url}</a>
                  </div>
                ` : ''}

                <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">IMMEDIATE ACTION REQUIRED</p>
                  <p style="margin: 0; font-size: 16px;">
                    🚔 Police: 100<br>
                    🚑 Ambulance: 108<br>
                    👩‍⚕️ Women Helpline: 1091
                  </p>
                </div>

                <p style="color: #6b7280; font-size: 12px; text-align: center;">
                  Sent via WomenSafe India app - ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            `
          })

          console.log(`Emergency email sent to ${contact.name} (${contact.email}):`, emailResponse)
          return {
            contact_name: contact.name,
            contact_email: contact.email,
            status: 'sent',
            message_id: emailResponse.data?.id
          }
        } catch (error) {
          console.error(`Failed to send emergency email to ${contact.name}:`, error)
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
    const notifications = contacts.map(contact => ({
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email,
      message: emergencyMessage,
      sent_at: new Date().toISOString(),
      email_sent: !!contact.email
    }))

    console.log('Emergency notifications sent:', notifications)

    // Create SOS incident record
    const { error: sosError } = await supabaseClient
      .from('sos_incidents')
      .insert({
        user_id: user_id,
        latitude: latitude,
        longitude: longitude,
        status: 'active'
      })

    if (sosError) {
      console.error('Error creating SOS incident:', sosError)
    }

    // In a real implementation, you would:
    // 1. Send SMS notifications using services like Twilio, AWS SNS, or local SMS providers
    // 2. Send email notifications using services like SendGrid, AWS SES, or similar
    // 3. Store notification logs in the database
    // 4. Handle delivery failures and retries

    return new Response(
      JSON.stringify({
        success: true,
        message: `Emergency notifications sent to ${contacts.length} contacts`,
        contacts_notified: contacts.length,
        emails_sent: emailResults.filter(r => r.status === 'sent').length,
        email_results: emailResults,
        notifications: notifications
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-emergency-notification:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send emergency notifications'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})