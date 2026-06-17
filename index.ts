import { registerRootComponent } from 'expo';

import App from './App';
import { initClientObservability } from './src/lib/sentry';

// Crash reporting (no-op until @sentry/react-native is installed and a DSN is set).
initClientObservability();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
