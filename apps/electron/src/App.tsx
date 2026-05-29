import { useState } from 'react';
import Login from './auth/Login';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';

type Step = 'login' | 'cv' | 'overlay';

const App = () => {
  const [step, setStep] = useState<Step>(() =>
    localStorage.getItem('access_token') ? 'cv' : 'login'
  );

  if (step === 'login') {
    return <Login onLogin={() => setStep('cv')} />;
  }

  if (step === 'cv') {
    return <CvSetup onDone={() => setStep('overlay')} />;
  }

  return <Overlay />;
};

export default App;
