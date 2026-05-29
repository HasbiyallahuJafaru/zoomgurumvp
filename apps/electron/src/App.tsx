import { useState } from 'react';
import Login from './auth/Login';
import Overlay from './overlay/Overlay';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem('access_token')
  );

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return <Overlay />;
};

export default App;
