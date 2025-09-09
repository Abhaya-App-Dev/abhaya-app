import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  safeZones?: Array<{ lat: number; lng: number; name: string; type: string; phone?: string }>;
}

const GoogleMap: React.FC<GoogleMapProps> = ({ 
  center = { lat: 28.6139, lng: 77.2090 },
  zoom = 12,
  onLocationChange,
  safeZones = []
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsLocationPermission, setNeedsLocationPermission] = useState(true);
  
  // Use environment variable instead of hardcoded key
  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Add error handling for missing API key
  useEffect(() => {
    if (!API_KEY) {
      setError('Google Maps API key is not configured. Please check your environment variables.');
    }
  }, [API_KEY]);

  const getCurrentLocation = useCallback(() => {
    setIsLoading(true);
    setNeedsLocationPermission(false);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
          onLocationChange?.(location);
          setIsLoading(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setCurrentLocation(center);
          onLocationChange?.(center);
          setIsLoading(false);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 300000 
        }
      );
    } else {
      setCurrentLocation(center);
      onLocationChange?.(center);
      setIsLoading(false);
    }
  }, [center, onLocationChange]);

  const initializeMap = useCallback(async () => {
    if (!mapRef.current || !currentLocation || !API_KEY) return;

    try {
      const loader = new Loader({
        apiKey: API_KEY, // Now using environment variable
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      const google = await loader.load();
      
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: currentLocation,
        zoom: zoom,
        styles: [
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }]
          }
        ],
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });

      setMap(mapInstance);

      // Add current location marker
      new google.maps.Marker({
        position: currentLocation,
        map: mapInstance,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3B82F6',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // Add safe zone markers
      safeZones.forEach((zone) => {
        const marker = new google.maps.Marker({
          position: { lat: zone.lat, lng: zone.lng },
          map: mapInstance,
          title: zone.name,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: zone.type === 'police' ? '#3B82F6' : zone.type === 'hospital' ? '#EF4444' : '#10B981',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; max-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${zone.name}</h3>
              <p style="margin: 4px 0; color: #666; font-size: 14px;">${zone.type}</p>
              ${zone.phone ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Phone:</strong> <a href="tel:${zone.phone}">${zone.phone}</a></p>` : ''}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstance, marker);
        });
      });

      // Draw safe zone circle
      if (safeZones.length > 0) {
        const isInSafeZone = safeZones.some(zone => {
          const distance = getDistance(currentLocation, { lat: zone.lat, lng: zone.lng });
          return distance <= 1000;
        });

        new google.maps.Circle({
          strokeColor: isInSafeZone ? '#10B981' : '#EF4444',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: isInSafeZone ? '#10B981' : '#EF4444',
          fillOpacity: 0.15,
          map: mapInstance,
          center: currentLocation,
          radius: 500
        });
      }

      setIsMapLoaded(true);

    } catch (error: any) {
      console.error('Error loading Google Maps:', error);
      setError(`Failed to load Google Maps: ${error.message || 'Unknown error'}`);
    }
  }, [currentLocation, zoom, safeZones, API_KEY]);

  const getDistance = (pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) => {
    const R = 6371e3;
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handleLocationClick = () => {
    getCurrentLocation();
    if (map && currentLocation) {
      map.setCenter(currentLocation);
      map.setZoom(15);
    }
  };

  useEffect(() => {
    if (currentLocation) {
      initializeMap();
    }
  }, [currentLocation, initializeMap]);

  // Show error if API key is missing
  if (!API_KEY) {
    return (
      <div className="w-full h-96 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
        <div className="text-center space-y-4 p-6">
          <div className="text-red-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-red-600">Google Maps API key not found</p>
          <p className="text-xs text-red-500">Please configure REACT_APP_GOOGLE_MAPS_API_KEY in your environment variables</p>
        </div>
      </div>
    );
  }

  // Rest of your component remains the same...
  if (needsLocationPermission) {
    return (
      <div className="w-full h-96 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
        <div className="text-center space-y-4 p-6">
          <div className="text-blue-600">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-blue-900">Enable Location Access</h3>
          <p className="text-sm text-blue-700 max-w-xs">
            Allow location access to see your current position and nearby safe places on the map.
          </p>
          <button
            onClick={getCurrentLocation}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enable Location
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-sm text-gray-600">Getting your location...</p>
          <p className="text-xs text-gray-500">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
        <div className="text-center space-y-4 p-6">
          <div className="text-red-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-red-600 max-w-md">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setNeedsLocationPermission(true);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden border">
      <div ref={mapRef} className="w-full h-full" />
      {isMapLoaded && (
        <button
          onClick={handleLocationClick}
          className="absolute bottom-4 right-4 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors border"
          title="Update location"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default GoogleMap;
