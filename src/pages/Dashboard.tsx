import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Shield, Users, MapPin, Phone, Settings, LogOut } from 'lucide-react';
import SOSButton from '@/components/SOSButton';
import EmergencyContacts from '@/components/EmergencyContacts';
import GoogleMap from '@/components/GoogleMap';
import NearbySafePlaces from '@/components/NearbySafePlaces';
import AudioVideoMessage from '@/components/AudioVideoMessage';
import BroadcastMessaging from '@/components/BroadcastMessaging';
import IndividualChat from '@/components/IndividualChat';
import { User, Session } from '@supabase/supabase-js';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [safeZones, setSafeZones] = useState<Array<{ lat: number; lng: number; name: string; type: string; phone?: string }>>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        } else if (session.user) {
          // Fetch user profile
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate('/auth');
      } else {
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate('/auth');
    }
  };

  const handleSOS = async () => {
    if (!user) return;

    try {
      // Get user's current location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Send emergency notification via edge function
          const { data, error } = await supabase.functions.invoke('send-emergency-notification', {
            body: {
              user_id: user.id,
              latitude: latitude,
              longitude: longitude,
              message: "Emergency SOS activated! I need immediate help."
            }
          });

          if (error) {
            console.error('Error sending emergency notification:', error);
            throw error;
          }

          console.log('Emergency notification sent:', data);
          
          toast({
            title: "SOS Activated",
            description: `Emergency alert sent to ${data?.contacts_notified || 0} contacts with your location.`,
            variant: "destructive",
          });
        },
        async (error) => {
          console.error('Geolocation error:', error);
          
          // Send SOS without location if geolocation fails
          const { data } = await supabase.functions.invoke('send-emergency-notification', {
            body: {
              user_id: user.id,
              message: "Emergency SOS activated! I need immediate help. (Location unavailable)"
            }
          });

          toast({
            title: "SOS Activated",
            description: `Emergency alert sent to ${data?.contacts_notified || 0} contacts.`,
            variant: "destructive",
          });
        }
      );
    } catch (error) {
      console.error('SOS error:', error);
      toast({
        title: "Error",
        description: "Failed to activate SOS. Please call emergency services directly.",
        variant: "destructive",
      });
    }
  };

  const handleLocationChange = (location: { lat: number; lng: number }) => {
    setUserLocation(location);
  };

  const handleSendEmergencyMessage = async (mediaBlob: Blob, type: 'audio' | 'video') => {
    if (!user) return;

    try {
      // Create a unique filename for the media
      const timestamp = new Date().getTime();
      const fileName = `emergency_${type}_${timestamp}.webm`;
      
      // In a production app, you would upload to Supabase Storage
      // For now, we'll create a mock URL and send the notification
      const mockMediaUrl = `https://emergency-media-storage.com/${fileName}`;
      
      // Get current location for the emergency message
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Send emergency notification with media
          const { data, error } = await supabase.functions.invoke('send-emergency-notification', {
            body: {
              user_id: user.id,
              latitude: latitude,
              longitude: longitude,
              message: `Emergency ${type} message recorded! Please check the attached ${type} for details.`,
              media_url: mockMediaUrl
            }
          });

          if (error) {
            console.error('Error sending emergency message:', error);
            throw error;
          }

          toast({
            title: "Emergency Message Sent",
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} message sent to ${data?.contacts_notified || 0} contacts`,
          });
        },
        async (error) => {
          console.error('Geolocation error:', error);
          
          // Send without location if geolocation fails
          const { data } = await supabase.functions.invoke('send-emergency-notification', {
            body: {
              user_id: user.id,
              message: `Emergency ${type} message recorded! Please check the attached ${type} for details. (Location unavailable)`,
              media_url: mockMediaUrl
            }
          });

          toast({
            title: "Emergency Message Sent", 
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} message sent to ${data?.contacts_notified || 0} contacts`,
          });
        }
      );
    } catch (error) {
      console.error('Error sending emergency message:', error);
      toast({
        title: "Error",
        description: "Failed to send emergency message",
        variant: "destructive",
      });
    }
  };

  // Sample safe zones data - in a real app, this would come from an API
  useEffect(() => {
    setSafeZones([
      { lat: 28.6139, lng: 77.2090, name: 'Delhi Police Control Room', type: 'Police Station', phone: '100' },
      { lat: 28.5672, lng: 77.2100, name: 'AIIMS Hospital', type: 'Hospital', phone: '011-26588500' },
      { lat: 19.0760, lng: 72.8777, name: 'Mumbai Police Control Room', type: 'Police Station', phone: '100' },
      { lat: 12.9716, lng: 77.5946, name: 'Bangalore City Police', type: 'Police Station', phone: '100' }
    ]);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Abhaya</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {profile?.first_name || user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Emergency Alert */}
            <Card className="border-emergency bg-emergency-light">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <AlertCircle className="h-12 w-12 text-emergency" />
                  <div>
                    <h3 className="text-lg font-semibold text-emergency-dark">
                      Emergency Services India
                    </h3>
                    <p className="text-emergency-dark/80">
                      In case of immediate danger: Police: <strong>100</strong> | Ambulance: <strong>108</strong> | Women Helpline: <strong>1091</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Maps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary" />
                  Live Location & Safe Routes
                </CardTitle>
                <CardDescription>
                  View your location and nearby safe zones on the map
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GoogleMap 
                  onLocationChange={handleLocationChange}
                  safeZones={safeZones}
                />
              </CardContent>
            </Card>

            {/* Emergency Message */}
            <AudioVideoMessage onSendMessage={handleSendEmergencyMessage} />

            {/* Safety Tips for India */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-primary" />
                  Safety Tips for Indian Women
                </CardTitle>
                <CardDescription>
                  Essential safety guidelines for Indian cities and communities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <h4 className="font-medium text-primary-dark">Trust Your Instincts</h4>
                    <p className="text-sm text-primary-dark/80">
                      If you feel unsafe in any situation, immediately move to a crowded area or nearest shop.
                    </p>
                  </div>
                  <div className="p-3 bg-safety-light rounded-lg">
                    <h4 className="font-medium text-safety-dark">Stay Connected</h4>
                    <p className="text-sm text-safety-dark/80">
                      Always inform family/friends about your whereabouts. Use live location sharing features.
                    </p>
                  </div>
                  <div className="p-3 bg-accent rounded-lg">
                    <h4 className="font-medium text-accent-foreground">Public Transport Safety</h4>
                    <p className="text-sm text-muted-foreground">
                      Travel in general compartments during day, ladies compartment at night. Avoid isolated areas.
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <h4 className="font-medium text-yellow-800">Emergency Contacts</h4>
                    <p className="text-sm text-yellow-700">
                      Save police stations and women helpline numbers in your speed dial: 100, 1091, 181.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Nearby Safe Places & Emergency Contacts */}
          <div className="space-y-6">
            <NearbySafePlaces userLocation={userLocation} />
            <EmergencyContacts />
            <BroadcastMessaging />
            <IndividualChat />
            
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your safety activity history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No recent activity. Stay safe!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Floating SOS Button */}
      <SOSButton onActivate={handleSOS} />
    </div>
  );
};

export default Dashboard;
