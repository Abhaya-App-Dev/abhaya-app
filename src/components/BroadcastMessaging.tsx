import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Send, MapPin, Users } from 'lucide-react';

const BroadcastMessaging: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        setContacts(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (contacts.length === 0) {
      toast({
        title: "Error",
        description: "No emergency contacts found",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let finalMessage = message;
      let latitude, longitude;

      if (includeLocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            });
          });
          
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          finalMessage += `\n\n📍 My current location: https://maps.google.com/maps?q=${latitude},${longitude}`;
        } catch (error) {
          console.error('Location error:', error);
          finalMessage += `\n\n📍 Location sharing was requested but unavailable`;
        }
      }

      // Send broadcast message via edge function
      const { data, error } = await supabase.functions.invoke('send-broadcast-message', {
        body: {
          user_id: user.id,
          subject: subject || 'Message from WomenSafe India',
          message: finalMessage,
          latitude: latitude,
          longitude: longitude,
          contacts: contacts
        }
      });

      if (error) {
        console.error('Error sending broadcast:', error);
        throw error;
      }

      toast({
        title: "Message Sent",
        description: `Broadcast sent to ${contacts.length} contacts`,
      });

      setMessage('');
      setSubject('');
      setIncludeLocation(false);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Broadcast error:', error);
      toast({
        title: "Error",
        description: "Failed to send broadcast message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="h-5 w-5 mr-2 text-primary" />
          Broadcast Messages
        </CardTitle>
        <CardDescription>
          Send messages to all your emergency contacts at once
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={contacts.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              Send Broadcast Message
              {contacts.length > 0 && (
                <span className="ml-2 text-xs">({contacts.length} contacts)</span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Broadcast Message</DialogTitle>
              <DialogDescription>
                This message will be sent to all {contacts.length} emergency contacts via email and notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject (optional)"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeLocation"
                  checked={includeLocation}
                  onChange={(e) => setIncludeLocation(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="includeLocation" className="text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Include my current location
                </Label>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendBroadcast}
                  disabled={sending || !message.trim()}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {contacts.length === 0 && (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Add emergency contacts to use broadcast messaging
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BroadcastMessaging;