import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Shield, Building, Heart, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SafePlace {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'government';
  address: string;
  phone?: string;
  distance?: number;
  lat: number;
  lng: number;
  rating?: number;
  isOpen?: boolean;
}

interface NearbySafePlacesProps {
  userLocation?: { lat: number; lng: number } | null;
  onNearestPlaceUpdate?: (places: SafePlace[]) => void; // New prop to send data to Dashboard
}

const NearbySafePlaces: React.FC<NearbySafePlacesProps> = ({ userLocation, onNearestPlaceUpdate }) => {
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState<20 | 50>(20);
  const [error, setError] = useState<string | null>(null);
  const [zoneStatus, setZoneStatus] = useState<{ zone: string; nearestDistance: number; nearestPlace: SafePlace | null }>({
    zone: 'unknown',
    nearestDistance: 0,
    nearestPlace: null
  });

  const API_KEY = 'AIzaSyBrvLvayBygbeBCjCCZQnnDLQeT3vmt0fs';

  const getDistance = (pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) => {
    const R = 6371e3; // in meters
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

  // Calculate zone status based on nearest safe place
  const calculateZoneStatus = (places: SafePlace[]) => {
    if (!userLocation || places.length === 0) {
      return { zone: 'unknown', nearestDistance: 0, nearestPlace: null };
    }

    let nearestDistance = Infinity;
    let nearestPlace: SafePlace | null = null;

    places.forEach(place => {
      if (place.distance && place.distance < nearestDistance) {
        nearestDistance = place.distance;
        nearestPlace = place;
      }
    });

    const distanceInKm = nearestDistance / 1000;

    if (distanceInKm <= 1.0) {
      return { zone: 'green', nearestDistance: distanceInKm, nearestPlace };
    } else if (distanceInKm <= 5.0) {
      return { zone: 'orange', nearestDistance: distanceInKm, nearestPlace };
    } else {
      return { zone: 'red', nearestDistance: distanceInKm, nearestPlace };
    }
  };

  const searchWithGoogleService = async (location: { lat: number; lng: number }, radius: number) => {
    if (!window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise<SafePlace[]>((resolve, reject) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      const allPlaces: SafePlace[] = [];
      let completedSearches = 0;

      const searchTypes = [
        { type: 'police', keywords: ['police station', 'police'] },
        { type: 'hospital' as const, keywords: ['hospital', 'emergency', 'medical center'] },
        { type: 'government' as const, keywords: ['government office', 'collectorate', 'fire station'] }
      ];

      const totalSearches = searchTypes.length * searchTypes[0].keywords.length;

      searchTypes.forEach((searchType) => {
        searchType.keywords.forEach((keyword) => {
          const request = {
            location: new google.maps.LatLng(location.lat, location.lng),
            radius: radius,
            keyword: keyword
          };

          service.nearbySearch(request, (results, status) => {
            completedSearches++;

            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              const places = results.map((place) => ({
                id: place.place_id!,
                name: place.name!,
                type: searchType.type as 'police' | 'hospital' | 'government',
                address: place.vicinity || 'Address not available',
                phone: undefined,
                lat: place.geometry!.location!.lat(),
                lng: place.geometry!.location!.lng(),
                rating: place.rating,
                isOpen: place.opening_hours?.open_now,
                distance: getDistance(location, {
                  lat: place.geometry!.location!.lat(),
                  lng: place.geometry!.location!.lng()
                })
              }));

              allPlaces.push(...places);
            }

            // Check if all searches are complete
            if (completedSearches === totalSearches) {
              // Remove duplicates and sort by distance
              const uniquePlaces = allPlaces.filter((place, index, self) => 
                index === self.findIndex(p => p.id === place.id)
              );

              const sortedPlaces = uniquePlaces.sort((a, b) => (a.distance || 0) - (b.distance || 0));
              resolve(sortedPlaces);
            }
          });
        });
      });
    });
  };

  const findNearbyPlaces = async (location: { lat: number; lng: number }) => {
    setLoading(true);
    setError(null);

    try {
      // First try 20km radius
      let places = await searchWithGoogleService(location, 20000);
      setSearchRadius(20);

      if (places.length === 0) {
        // If no places in 20km, try 50km radius
        places = await searchWithGoogleService(location, 50000);
        setSearchRadius(50);
      }

      // Return top 8 nearest places
      const nearestPlaces = places.slice(0, 8);
      setSafePlaces(nearestPlaces);

      // Calculate and update zone status
      const status = calculateZoneStatus(nearestPlaces);
      setZoneStatus(status);

      // Send data to Dashboard for zone display
      onNearestPlaceUpdate?.(nearestPlaces);

    } catch (error) {
      console.error('Error finding nearby places:', error);
      setError('Unable to fetch nearby places. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation) {
      findNearbyPlaces(userLocation);
    }
  }, [userLocation]);

  const refreshPlaces = () => {
    if (userLocation) {
      findNearbyPlaces(userLocation);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'police':
        return <Shield className="h-5 w-5 text-blue-600" />;
      case 'hospital':
        return <Heart className="h-5 w-5 text-red-600" />;
      case 'government':
        return <Building className="h-5 w-5 text-green-600" />;
      default:
        return <MapPin className="h-5 w-5 text-primary" />;
    }
  };

  const getZoneIcon = (zone: string) => {
    switch (zone) {
      case 'green':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'orange':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'red':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-600" />;
    }
  };

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'orange':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    }
    return `${(distance / 1000).toFixed(1)}km away`;
  };

  const makeCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const getDirections = (place: SafePlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&destination_place_id=${place.id}`;
    window.open(url, '_blank');
  };

  if (!userLocation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-primary" />
            Nearby Safe Places
          </CardTitle>
          <CardDescription>
            Allow location access to see nearby safe places
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Enable location services to find nearby police stations, hospitals, and government offices
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2 text-primary animate-spin" />
            Finding Safe Places
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Searching for nearby police stations, hospitals, and government offices...
            </p>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              Nearby Safe Places
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshPlaces}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="text-red-500 mb-4">
              <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-primary" />
            Nearby Safe Places
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
              Within {searchRadius}km
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshPlaces}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Real-time nearby police stations, hospitals, and government offices (sorted by distance)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Zone Status Mini Card */}
        {zoneStatus.zone !== 'unknown' && (
          <div className={`p-3 rounded-lg border mb-4 ${getZoneColor(zoneStatus.zone)}`}>
            <div className="flex items-center space-x-2">
              {getZoneIcon(zoneStatus.zone)}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {zoneStatus.zone === 'green' && '✅ You are in a safe zone'}
                  {zoneStatus.zone === 'orange' && `⚠️ ${zoneStatus.nearestDistance.toFixed(1)}km to safety`}
                  {zoneStatus.zone === 'red' && `🚨 ${zoneStatus.nearestDistance.toFixed(1)}km from nearest safe place`}
                </p>
                {zoneStatus.nearestPlace && (
                  <p className="text-xs opacity-75">
                    Nearest: {zoneStatus.nearestPlace.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {safePlaces.length === 0 ? (
          <div className="text-center py-6">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No safe places found within 50km radius
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              You can still use emergency helplines below
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshPlaces}
              className="mt-3"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Search Again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {safePlaces.map((place, index) => (
              <div
                key={place.id}
                className={`p-3 border rounded-lg hover:shadow-sm transition-shadow ${
                  index === 0 ? 'border-green-200 bg-green-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {getIcon(place.type)}
                      <h4 className="font-medium text-sm">{place.name}</h4>
                      {index === 0 && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">
                          Nearest
                        </span>
                      )}
                      {place.rating && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full">
                          ⭐ {place.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {place.address}
                    </p>
                    {place.distance && (
                      <p className="text-xs text-primary font-medium">
                        {formatDistance(place.distance)}
                      </p>
                    )}
                    {place.isOpen !== undefined && (
                      <p className={`text-xs ${place.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                        {place.isOpen ? 'Open now' : 'Closed'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => getDirections(place)}
                      className="text-xs"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Directions
                    </Button>
                    {place.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => makeCall(place.phone!)}
                        className="text-xs"
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Emergency Numbers */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-medium text-sm mb-3">Emergency Helplines</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => makeCall('100')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Police: 100
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => makeCall('108')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Ambulance: 108
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => makeCall('1091')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Women Helpline
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => makeCall('181')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Women in Distress
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NearbySafePlaces;
