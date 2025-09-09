import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, MapPin, Phone, AlertTriangle, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-white" />
              <h1 className="text-2xl font-bold text-white">Abhaya</h1>
            </div>
            <Button 
              onClick={() => navigate('/auth')}
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-8">
              Your Safety,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">
                Our Priority
              </span>
            </h2>
            
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto">
              A comprehensive safety platform designed to protect and empower women 
              with emergency features, safe navigation, and instant help when needed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Button 
                onClick={() => navigate('/auth')}
                size="xl"
                className="bg-white text-primary hover:bg-white/90 shadow-xl"
              >
                Get Started Now
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button 
                variant="outline"
                size="xl"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Learn More
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="bg-emergency/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">SOS Alert</h3>
                <p className="text-white/80 text-sm">
                  Instant emergency alerts to your trusted contacts with live location sharing
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="bg-safety/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Safe Routes</h3>
                <p className="text-white/80 text-sm">
                  AI-powered route suggestions avoiding unsafe areas with real-time safety data
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="bg-primary/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Emergency Contacts</h3>
                <p className="text-white/80 text-sm">
                  Manage trusted contacts who will be notified in case of emergencies
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="bg-accent/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Quick Exit</h3>
                <p className="text-white/80 text-sm">
                  Fake calls and quick exit features to help you safely leave situations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Notice */}
        <div className="bg-emergency/10 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="flex justify-center items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-white mr-2" />
                <h4 className="text-lg font-semibold text-white">Emergency Services</h4>
              </div>
              <p className="text-white/90 text-lg">
                In case of immediate danger, always call your local emergency number first
              </p>
              <p className="text-white/70 mt-2">
                🇺🇸 USA: 911 • 🇬🇧 UK: 999 • 🇪🇺 EU: 112 • 🇦🇺 Australia: 000
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Shield className="h-6 w-6 text-white mr-2" />
              <span className="text-white font-semibold">WomenSafe</span>
            </div>
            <p className="text-white/70 text-sm">
              Empowering women with technology for a safer world
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
