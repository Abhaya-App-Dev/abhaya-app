import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Send, MapPin, Phone, Mail } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
}

const IndividualChat: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        setContacts(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact || !message.trim()) {
      toast({
        title: "Error",
        description: "Please select a contact and enter a message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const contact = contacts.find(c => c.id === selectedContact);
      if (!contact) return;

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

      // Send individual message via edge function
      const { data, error } = await supabase.functions.invoke('send-individual-message', {
        body: {
          user_id: user.id,
          contact: contact,
          subject: subject || 'Message from WomenSafe India',
          message: finalMessage,
          latitude: latitude,
          longitude: longitude
        }
      });

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      toast({
        title: "Message Sent",
        description: `Message sent to ${contact.name}`,
      });

      setMessage('');
      setSubject('');
      setSelectedContact('');
      setIncludeLocation(false);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const selectedContactData = contacts.find(c => c.id === selectedContact);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageCircle className="h-5 w-5 mr-2 text-primary" />
          Individual Chat
        </CardTitle>
        <CardDescription>
          Send a message to a specific emergency contact
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={contacts.length === 0} variant="outline">
              <MessageCircle className="h-4 w-4 mr-2" />
              Send Individual Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Individual Message</DialogTitle>
              <DialogDescription>
                Send a message to a specific emergency contact
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Select Contact *</Label>
                <Select value={selectedContact} onValueChange={setSelectedContact}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {contact.relationship && `${contact.relationship} • `}
                            {contact.phone}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContactData && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium">{selectedContactData.name}</div>
                    <div className="flex items-center text-muted-foreground mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      {selectedContactData.phone}
                    </div>
                    {selectedContactData.email && (
                      <div className="flex items-center text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        {selectedContactData.email}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
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
                  onClick={handleSendMessage}
                  disabled={sending || !selectedContact || !message.trim()}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {contacts.length === 0 && (
          <div className="text-center py-6">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Add emergency contacts to send individual messages
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IndividualChat;