import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Shield, Users, MapPin, Phone, Settings, LogOut, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
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
  const [nearestSafePlaces, setNearestSafePlaces] = useState<any[]>([]); // Changed from safeZones
  const [zoneStatus, setZoneStatus] = useState<{ zone: string; message: string; nearestDistance: number; nearestPlace: any }>({
    zone: 'unknown',
    message: 'Getting your location...',
    nearestDistance: 0,
    nearestPlace: null
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Calculate distance between two coordinates using Haversine formula
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (value: number) => value * Math.PI / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Determine safety zone status based on distance to nearest safe place
  const checkSafetyZone = (userLoc: { lat: number; lng: number }, safePlaces: any[]) => {
    if (!userLoc || safePlaces.length === 0) {
      return {
        zone: 'unknown',
        message: 'Searching for nearby safe places...',
        nearestDistance: 0,
        nearestPlace: null
      };
    }

    let nearestDistance = Infinity;
    let nearestPlace = null;

    // Find nearest safe place from real Google Maps data
    safePlaces.forEach(place => {
      // Distance is already calculated in meters from NearbySafePlaces
      const distanceKm = place.distance ? place.distance / 1000 : 
                        getDistance(userLoc.lat, userLoc.lng, place.lat, place.lng);
      
      if (distanceKm < nearestDistance) {
        nearestDistance = distanceKm;
        nearestPlace = place;
      }
    });

    // Determine zone based on distance
    if (nearestDistance <= 1.0) { // Within 1km - Green Zone
      return {
        zone: 'green',
        message: `✅ You are in a safe green zone near ${nearestPlace?.name}`,
        nearestDistance,
        nearestPlace
      };
    } else if (nearestDistance <= 5.0) { // 1-5km - Orange Zone
      return {
        zone: 'orange',
        message: `⚠️ Orange zone: ${nearestDistance.toFixed(1)}km from ${nearestPlace?.name}`,
        nearestDistance,
        nearestPlace
      };
    } else { // >5km - Red Zone
      return {
        zone: 'red',
        message: `🚨 High risk red zone: ${nearestDistance.toFixed(1)}km from nearest safe place ${nearestPlace?.name}`,
        nearestDistance,
        nearestPlace
      };
    }
  };

  // Handle safe places data from NearbySafePlaces component
  const handleNearestPlacesUpdate = (places: any[]) => {
    setNearestSafePlaces(places);
    
    if (userLocation && places.length > 0) {
      const status = checkSafetyZone(userLocation, places);
      setZoneStatus(status);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        } else if (session.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        }
      }
    );

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
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
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

          toast({
            title: "SOS Activated",
            description: `Emergency alert sent to ${data?.contacts_notified || 0} contacts with your location.`,
            variant: "destructive",
          });
        },
        async (error) => {
          console.error('Geolocation error:', error);
          
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
    
    // Update zone status if we have safe places data
    if (nearestSafePlaces.length > 0) {
      const status = checkSafetyZone(location, nearestSafePlaces);
      setZoneStatus(status);
    }
  };

  const handleSendEmergencyMessage = async (mediaBlob: Blob, type: 'audio' | 'video') => {
    if (!user) return;

    try {
      const timestamp = new Date().getTime();
      const fileName = `emergency_${type}_${timestamp}.webm`;
      const mockMediaUrl = `https://emergency-media-storage.com/${fileName}`;
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
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

  // Get zone color and icon
  const getZoneDisplay = (zone: string) => {
    switch (zone) {
      case 'green':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        };
      case 'orange':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800'
        };
      case 'red':
        return {
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        };
      default:
        return {
          icon: <MapPin className="h-5 w-5 text-gray-600" />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800'
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const zoneDisplay = getZoneDisplay(zoneStatus.zone);

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
            
            {/* Zone Status Alert */}
            <Card className={`${zoneDisplay.bgColor} ${zoneDisplay.borderColor} border-2`}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  {zoneDisplay.icon}
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${zoneDisplay.textColor}`}>
                      Safety Zone Status: {zoneStatus.zone.toUpperCase()}
                    </h3>
                    <p className={`${zoneDisplay.textColor} opacity-90`}>
                      {zoneStatus.message}
                    </p>
                    {zoneStatus.nearestDistance > 0 && zoneStatus.nearestPlace && (
                      <div className={`text-sm ${zoneDisplay.textColor} opacity-75 mt-2`}>
                        <p>📍 Nearest safe place: {zoneStatus.nearestDistance.toFixed(1)}km away</p>
                        <p className="text-xs mt-1">🏢 {zoneStatus.nearestPlace.type}: {zoneStatus.nearestPlace.name}</p>
                        {zoneStatus.zone === 'orange' && (
                          <p className="text-xs font-medium mt-1">
                            🚶‍♀️ Move towards the nearest safe place for better safety
                          </p>
                        )}
                        {zoneStatus.zone === 'red' && (
                          <p className="text-xs font-medium mt-1">
                            ⚠️ You're in a high-risk area. Please reach a safe place immediately
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  safeZones={nearestSafePlaces} // Pass real data from NearbySafePlaces
                />
              </CardContent>
            </Card>

            {/* Emergency Message */}
            <AudioVideoMessage userLocation={userLocation} />

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
            <NearbySafePlaces 
              userLocation={userLocation} 
              onNearestPlaceUpdate={handleNearestPlacesUpdate} // Callback to receive real data
            />
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
