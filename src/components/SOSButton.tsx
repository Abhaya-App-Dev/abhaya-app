import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SOSButtonProps {
  onActivate: () => void;
}

const SOSButton: React.FC<SOSButtonProps> = ({ onActivate }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleSOS = () => {
    setIsPressed(true);
    onActivate();
    
    // Reset the pressed state after animation
    setTimeout(() => {
      setIsPressed(false);
    }, 1000);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="emergency"
            size="emergency"
            className={`
              relative overflow-hidden shadow-emergency hover:shadow-2xl
              ${isPressed ? 'animate-pulse scale-110' : 'animate-pulse'}
            `}
            style={{
              animationDuration: '2s',
              animationIterationCount: 'infinite'
            }}
          >
            <AlertTriangle className="h-8 w-8" />
            <span className="sr-only">Emergency SOS</span>
            
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full border-2 border-emergency animate-ping opacity-75" />
          </Button>
        </AlertDialogTrigger>
        
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-emergency">
              <AlertTriangle className="h-6 w-6 mr-2" />
              Emergency SOS
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately notify your emergency contacts with your current location 
              and activate emergency protocols. Only use this in case of real emergency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSOS}
              className="bg-emergency hover:bg-emergency/90 text-emergency-foreground"
            >
              ACTIVATE SOS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SOSButton;