import { useState } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';

type Step = 'login' | 'register' | 'dashboard' | 'cv' | 'overlay';

const App = () => {
  const [step, setStep] = useState<Step>(() =>
    localStorage.getItem('access_token') ? 'dashboard' : 'login'
  );

  function handleLogout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('session_id');
    setStep('login');
  }

  if (step === 'login') {
    return (
      <Login
        onLogin={() => setStep('dashboard')}
        onShowRegister={() => setStep('register')}
      />
    );
  }

  if (step === 'register') {
    return (
      <Register
        onRegistered={() => setStep('dashboard')}
        onShowLogin={() => setStep('login')}
      />
    );
  }

  if (step === 'dashboard') {
    return (
      <Dashboard
        onContinue={() => setStep('cv')}
        onLogout={handleLogout}
      />
    );
  }

  if (step === 'cv') {
    return <CvSetup onDone={() => setStep('overlay')} />;
  }

  return <Overlay onLogout={handleLogout} />;
};

export default App;
