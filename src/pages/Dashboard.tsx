import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertCircle, Shield, Users, MapPin, Phone, LogOut, 
  CheckCircle, AlertTriangle, XCircle, Mic, Activity, 
  Menu, X, Heart, ShieldAlert, Navigation, ChevronRight, Eye
} from 'lucide-react';
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
  const [nearestSafePlaces, setNearestSafePlaces] = useState<any[]>([]);
  const [zoneStatus, setZoneStatus] = useState<{ zone: string; message: string; nearestDistance: number; nearestPlace: any }>({
    zone: 'unknown',
    message: 'Getting your location...',
    nearestDistance: 0,
    nearestPlace: null
  });
  
  // New layout states
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'messages' | 'contacts' | 'helplines'>('overview');
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Array<{ id: string; type: string; time: string; details: string }>>([
    { id: '1', type: 'system', time: 'Just now', details: 'Dashboard updated and synchronized with Supabase' }
  ]);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Haversine formula to calculate distance between coordinates
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

  // Determine safety zone level
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

    safePlaces.forEach(place => {
      const distanceKm = place.distance ? place.distance / 1000 : 
                        getDistance(userLoc.lat, userLoc.lng, place.lat, place.lng);
      
      if (distanceKm < nearestDistance) {
        nearestDistance = distanceKm;
        nearestPlace = place;
      }
    });

    if (nearestDistance <= 1.0) {
      return {
        zone: 'green',
        message: `You are in a safe Green zone near ${nearestPlace?.name}`,
        nearestDistance,
        nearestPlace
      };
    } else if (nearestDistance <= 5.0) {
      return {
        zone: 'orange',
        message: `Orange zone: ${nearestDistance.toFixed(1)}km from ${nearestPlace?.name}`,
        nearestDistance,
        nearestPlace
      };
    } else {
      return {
        zone: 'red',
        message: `High risk Red zone: ${nearestDistance.toFixed(1)}km from nearest safe place (${nearestPlace?.name || 'unknown'})`,
        nearestDistance,
        nearestPlace
      };
    }
  };

  const handleNearestPlacesUpdate = (places: any[]) => {
    setNearestSafePlaces(places);
    if (userLocation && places.length > 0) {
      const status = checkSafetyZone(userLocation, places);
      setZoneStatus(status);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        } else if (session.user) {
          fetchUserProfile(session.user.id);
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

  // SOS Countdown Hook
  useEffect(() => {
    if (sosCountdown === null) return;

    if (sosCountdown === 0) {
      setSosCountdown(null);
      triggerSOS();
      return;
    }

    const timer = setTimeout(() => {
      setSosCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [sosCountdown]);

  const handleSOSClick = () => {
    setSosCountdown(3);
    toast({
      title: "SOS Countdown Triggered",
      description: "Emergency alert will send in 3 seconds. Click Cancel if accidental.",
      variant: "destructive",
    });
  };

  const cancelSOS = () => {
    setSosCountdown(null);
    toast({
      title: "SOS Aborted",
      description: "Countdown cancelled. No notifications were sent.",
    });
  };

  const triggerSOS = async () => {
    if (!user) return;

    // Log the SOS trigger activity
    setActivityLogs(prev => [
      { id: Date.now().toString(), type: 'sos', time: 'Just now', details: 'Emergency SOS alert activated' },
      ...prev
    ]);

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

          if (error) throw error;

          toast({
            title: "SOS Alert Dispatched",
            description: `Emergency alert successfully sent to ${data?.contacts_notified || 0} contacts.`,
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
            title: "SOS Alert Dispatched",
            description: `Alert sent to ${data?.contacts_notified || 0} contacts without coordinates.`,
            variant: "destructive",
          });
        }
      );
    } catch (error) {
      console.error('SOS error:', error);
      toast({
        title: "SOS Transmission Failed",
        description: "Please call 100 or 1091 directly.",
        variant: "destructive",
      });
    }
  };

  const handleLocationChange = (location: { lat: number; lng: number }) => {
    setUserLocation(location);
    if (nearestSafePlaces.length > 0) {
      const status = checkSafetyZone(location, nearestSafePlaces);
      setZoneStatus(status);
    }
  };

  const getZoneDisplay = (zone: string) => {
    switch (zone) {
      case 'green':
        return {
          icon: <CheckCircle className="h-5 w-5 text-emerald-500" />,
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-600 dark:text-emerald-400',
          badgeColor: 'bg-emerald-500 text-white',
          safetyText: 'Safe Area',
          shadowColor: 'shadow-emerald-500/10'
        };
      case 'orange':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-600 dark:text-amber-400',
          badgeColor: 'bg-amber-500 text-white',
          safetyText: 'Caution Area',
          shadowColor: 'shadow-amber-500/10'
        };
      case 'red':
        return {
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-600 dark:text-rose-400',
          badgeColor: 'bg-rose-500 text-white',
          safetyText: 'High Risk Area',
          shadowColor: 'shadow-rose-500/10'
        };
      default:
        return {
          icon: <MapPin className="h-5 w-5 text-gray-500" />,
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          textColor: 'text-gray-600 dark:text-gray-400',
          badgeColor: 'bg-gray-500 text-white',
          safetyText: 'Unknown Level',
          shadowColor: 'shadow-gray-500/10'
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-rose-500"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Syncing with Abhaya network...</p>
      </div>
    );
  }

  const zoneDisplay = getZoneDisplay(zoneStatus.zone);

  // Sidebar Menu Items
  const menuItems = [
    { id: 'overview', name: 'Overview', icon: <Shield className="h-5 w-5" /> },
    { id: 'map', name: 'Tracking & Safe Places', icon: <MapPin className="h-5 w-5" /> },
    { id: 'messages', name: 'Emergency Media & Alerts', icon: <Mic className="h-5 w-5" /> },
    { id: 'contacts', name: 'Trusted Circle', icon: <Users className="h-5 w-5" /> },
    { id: 'helplines', name: 'Help Dials', icon: <Phone className="h-5 w-5" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-900 dark:text-slate-100">
      
      {/* 3-Second SOS Countdown Overlay */}
      {sosCountdown !== null && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
          <div className="relative flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-sm">
            {/* Concentric ripples */}
            <div className="absolute w-64 h-64 border border-rose-500/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute w-48 h-48 border border-rose-500/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            
            <div className="w-32 h-32 rounded-full bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/50 relative z-10">
              <span className="text-6xl font-black text-white animate-pulse">{sosCountdown}</span>
            </div>
            
            <h2 className="text-2xl font-bold text-white relative z-10">TRANSMITTING SOS SIGNAL</h2>
            <p className="text-slate-400 text-sm relative z-10">
              Your trusted contacts and emergency services will receive your live location coordinates in a few seconds.
            </p>
            
            <Button 
              size="lg" 
              variant="outline" 
              onClick={cancelSOS}
              className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold relative z-10 transition-transform active:scale-95"
            >
              CANCEL ALERT
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Top Navbar */}
      <header className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="h-6 w-6 text-rose-500" />
          <span className="font-extrabold text-lg tracking-wider text-rose-600 dark:text-rose-500">ABHAYA</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <nav className={`
        fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:static md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 
        dark:border-slate-800 p-4 transition-transform duration-300 ease-in-out z-40 shadow-md md:shadow-none shrink-0
      `}>
        {/* Sidebar Header logo */}
        <div className="hidden md:flex items-center space-x-2 pb-6 border-b border-slate-100 dark:border-slate-800 mb-6">
          <ShieldAlert className="h-8 w-8 text-rose-500 animate-pulse" />
          <span className="font-black text-xl tracking-wider text-rose-600 dark:text-rose-400">ABHAYA</span>
        </div>

        {/* User profile brief */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl mb-6 border border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Heart className="h-5 w-5 text-rose-500" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-slate-400 font-medium">Trusted Identity</p>
              <h4 className="font-bold text-sm truncate">{profile?.first_name || user?.email?.split('@')[0] || 'Citizen'}</h4>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="flex-1 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200
                ${activeTab === item.id 
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }
              `}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {/* Sign Out Button */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 rounded-xl"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-xs" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
        
        {/* Dynamic Header on Desktop */}
        <div className="hidden md:flex justify-between items-center mb-8 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white capitalize">
              {activeTab === 'overview' ? 'Command Center' : activeTab === 'messages' ? 'Emergency Media' : activeTab}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Active monitoring network synchronized to your trusted contacts list.
            </p>
          </div>
          <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-full border shadow-xs">
            <span className={`w-3 h-3 rounded-full animate-pulse ${zoneStatus.zone === 'green' ? 'bg-emerald-500' : zoneStatus.zone === 'orange' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{zoneDisplay.safetyText}</span>
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            
            {/* Top Interactive SOS Console */}
            <Card className="lg:col-span-2 overflow-hidden border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-rose-600/0 relative shadow-md">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-4 max-w-md text-center sm:text-left">
                  <span className="px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-xs font-extrabold tracking-wider uppercase">
                    SOS Emergency Hub
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight">Need immediate help?</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Pressing the SOS button alerts your entire trusted circle and broadcasts your current GPS coordinate immediately via automated emails and SMS dispatchers.
                  </p>
                  
                  {/* Local Helpline Badges */}
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <span className="bg-slate-100 dark:bg-slate-800 text-xs px-3 py-1.5 rounded-lg font-bold border">
                      Police: 100
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-xs px-3 py-1.5 rounded-lg font-bold border">
                      Women Helpline: 1091
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-xs px-3 py-1.5 rounded-lg font-bold border">
                      Ambulance: 108
                    </span>
                  </div>
                </div>

                {/* Pulsing SOS Console Button */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <button 
                    onClick={handleSOSClick}
                    className="w-36 h-36 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white font-black text-2xl border-4 border-white dark:border-slate-800 shadow-xl shadow-rose-500/30 hover:scale-105 active:scale-95 transition-transform duration-200 relative group flex flex-col items-center justify-center space-y-1"
                  >
                    <div className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-25 group-hover:opacity-40 transition-opacity" style={{ animationDuration: '1.5s' }} />
                    <ShieldAlert className="h-8 w-8" />
                    <span>SOS</span>
                  </button>
                  <span className="text-xs font-bold text-rose-500 mt-3 animate-pulse">TAP TO DISPATCH</span>
                </div>
              </CardContent>
            </Card>

            {/* Safety Score/Gauge status card */}
            <Card className={`border-2 ${zoneDisplay.borderColor} ${zoneDisplay.shadowColor} overflow-hidden shadow-sm`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  Safety Zone Status
                  {zoneDisplay.icon}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-black uppercase ${zoneDisplay.textColor}`}>
                    {zoneStatus.zone}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Zone level</span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {zoneStatus.message}
                </p>

                {zoneStatus.nearestDistance > 0 && zoneStatus.nearestPlace && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span className="font-medium">Nearest Safe Shelter:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{zoneStatus.nearestPlace.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Distance:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{zoneStatus.nearestDistance.toFixed(1)} km</span>
                    </div>
                    {zoneStatus.zone === 'orange' && (
                      <p className="text-rose-500 font-bold mt-2 flex items-center">
                        <Navigation className="h-3.5 w-3.5 mr-1" /> Move closer to green zones if possible
                      </p>
                    )}
                    {zoneStatus.zone === 'red' && (
                      <p className="text-rose-600 font-extrabold mt-2 flex items-center animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5 mr-1" /> Reach a safe place immediately!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Helper Links / Map preview box */}
            <Card className="lg:col-span-2 overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-rose-500" />
                  Live Location Preview
                </CardTitle>
                <CardDescription>
                  Shows your coordinate location. Access the Map tab to view safe routes.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] relative overflow-hidden bg-slate-100 dark:bg-slate-900 rounded-xl m-6 mt-0 border p-0">
                {/* Embedded dynamic Preview map */}
                <GoogleMap 
                  onLocationChange={handleLocationChange}
                  safeZones={nearestSafePlaces}
                />
              </CardContent>
            </Card>

            {/* Recent Activity Log & Tips */}
            <div className="space-y-6">
              
              {/* Activity feed */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    System Feed
                    <Activity className="h-4 w-4 text-slate-400" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="p-4 flex items-start space-x-3 text-xs">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.type === 'sos' ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{log.details}</p>
                          <span className="text-slate-400 text-[10px]">{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Safety Cards */}
              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Safety Tips Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                    <h5 className="font-bold text-rose-500 mb-0.5">Trust Your Instincts</h5>
                    <p className="text-slate-500">If a location feels unsafe, immediately move to a well-lit/crowded shop.</p>
                  </div>
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                    <h5 className="font-bold text-rose-500 mb-0.5">Live Sharing</h5>
                    <p className="text-slate-500">Share your real-time coordinates with your trusted contacts whenever travelling late.</p>
                  </div>
                </CardContent>
              </Card>

            </div>

          </div>
        )}

        {/* Tab 2: MAP & SAFE PLACES */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in h-[calc(100vh-140px)]">
            {/* Left side: Live Map */}
            <div className="lg:col-span-2 flex flex-col h-full space-y-4">
              <Card className="flex-1 overflow-hidden flex flex-col border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-rose-500" />
                    Interactive Safety Map
                  </CardTitle>
                  <CardDescription>
                    Your current location is pinned. Nearby safe zones are displayed based on your search radius.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 relative p-0 m-6 mt-0 rounded-xl overflow-hidden border">
                  <GoogleMap 
                    onLocationChange={handleLocationChange}
                    safeZones={nearestSafePlaces}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right side: Nearby list */}
            <div className="h-full overflow-y-auto">
              <NearbySafePlaces 
                userLocation={userLocation} 
                onNearestPlaceUpdate={handleNearestPlacesUpdate}
              />
            </div>
          </div>
        )}

        {/* Tab 3: EMERGENCY MESSAGING */}
        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Quick Media Recorder */}
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-600/0 shadow-xs">
                <CardHeader>
                  <CardTitle className="flex items-center text-indigo-600 dark:text-indigo-400">
                    <Mic className="h-5 w-5 mr-2" />
                    Quick Dispatch Recorder
                  </CardTitle>
                  <CardDescription>
                    Record a 15-30 second audio or video proof that automatically uploads to Supabase storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <AudioVideoMessage userLocation={userLocation} />
                </CardContent>
              </Card>
            </div>

            {/* Broadcast & Chats */}
            <div className="space-y-6">
              <BroadcastMessaging />
              <IndividualChat />
            </div>
          </div>
        )}

        {/* Tab 4: TRUSTED CIRCLE */}
        {activeTab === 'contacts' && (
          <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
            <Card className="bg-slate-900 text-white overflow-hidden shadow-md">
              <CardContent className="p-6 sm:p-8 flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black">Your Trusted Safety Ring</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Emergency contacts added here will be notified automatically with coordinates during any SOS activation or broadcast event.
                  </p>
                </div>
                <div className="hidden sm:flex w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Users className="h-8 w-8 text-rose-500" />
                </div>
              </CardContent>
            </Card>

            <EmergencyContacts />
          </div>
        )}

        {/* Tab 5: HELPLINES */}
        {activeTab === 'helplines' && (
          <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
            
            <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-6 flex items-start space-x-4">
                <AlertTriangle className="h-6 w-6 text-amber-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-400">National Dispatch Notice</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    These dialers initiate immediate cellular connections to the verified government emergency hotlines in India. Use these contacts to seek immediate police dispatch or medical rescue.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center">
                  <Phone className="h-5 w-5 mr-2 text-rose-500" />
                  Indian Helpline Quick Dialer
                </CardTitle>
                <CardDescription>
                  One-tap to initiate phone calls to the national emergency services.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Police */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border hover:border-rose-500/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">🚔 Police / Control Room</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Primary police helpdesk dispatch</p>
                    </div>
                    <a href="tel:100" className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-sm px-4 py-2 rounded-lg transition-transform active:scale-95 shadow-xs shadow-rose-500/10">
                      DIAL 100
                    </a>
                  </div>

                  {/* Women Helpline */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border hover:border-rose-500/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">👩‍⚕️ Women Helpline</h4>
                      <p className="text-slate-400 text-xs mt-0.5">National women helpline desk</p>
                    </div>
                    <a href="tel:1091" className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-sm px-4 py-2 rounded-lg transition-transform active:scale-95 shadow-xs shadow-rose-500/10">
                      DIAL 1091
                    </a>
                  </div>

                  {/* Ambulance */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border hover:border-rose-500/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">🚑 Ambulance / Trauma</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Emergency medical dispatch support</p>
                    </div>
                    <a href="tel:108" className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-sm px-4 py-2 rounded-lg transition-transform active:scale-95 shadow-xs shadow-rose-500/10">
                      DIAL 108
                    </a>
                  </div>

                  {/* Women in Distress */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border hover:border-rose-500/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">🛡️ Distress & Abuse</h4>
                      <p className="text-slate-400 text-xs mt-0.5">National Domestic violence helpdesk</p>
                    </div>
                    <a href="tel:181" className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-sm px-4 py-2 rounded-lg transition-transform active:scale-95 shadow-xs shadow-rose-500/10">
                      DIAL 181
                    </a>
                  </div>

                </div>
              </CardContent>
            </Card>

          </div>
        )}

      </main>

      {/* Background Safe Places fetcher to keep safety status synchronized on overview page */}
      {activeTab !== 'map' && (
        <div className="hidden">
          <NearbySafePlaces 
            userLocation={userLocation} 
            onNearestPlaceUpdate={handleNearestPlacesUpdate}
          />
        </div>
      )}

      {/* Mobile Bottom Tab Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex justify-around items-center z-30 shadow-lg">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-bold transition-colors
              ${activeTab === item.id 
                ? 'text-rose-500 dark:text-rose-400' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700'
              }
            `}
          >
            {item.icon}
            <span className="mt-1">{item.name.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

    </div>
  );
};

export default Dashboard;
