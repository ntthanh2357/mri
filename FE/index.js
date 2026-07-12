import './src/tailwind-built.css';
import { registerRootComponent } from 'expo';
import { Alert, Platform } from 'react-native';

import AppNavigator from './src/navigation/AppNavigator';

// Custom high-fidelity Alert.alert Web Polyfill
if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    // If no buttons, default to a standard close button
    if (!buttons || buttons.length === 0) {
      buttons = [{ text: 'OK' }];
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.4)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    const box = document.createElement('div');
    box.style.backgroundColor = '#ffffff';
    box.style.borderRadius = '16px';
    box.style.padding = '24px';
    box.style.width = '90%';
    box.style.maxWidth = '400px';
    box.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    box.style.border = '1px solid #E2E8F0';
    box.style.animation = 'fadeIn 0.2s ease-out';

    const titleEl = document.createElement('h3');
    titleEl.innerText = title || '';
    titleEl.style.fontSize = '16px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#0F172A';
    titleEl.style.margin = '0 0 8px 0';

    const msgEl = document.createElement('p');
    msgEl.innerText = message || '';
    msgEl.style.fontSize = '13px';
    msgEl.style.color = '#64748B';
    msgEl.style.margin = '0 0 20px 0';
    msgEl.style.lineHeight = '1.5';

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '8px';

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.innerText = btn.text || 'OK';
      button.style.padding = '10px 16px';
      button.style.borderRadius = '8px';
      button.style.border = 'none';
      button.style.fontSize = '13px';
      button.style.fontWeight = 'bold';
      button.style.cursor = 'pointer';
      button.style.width = '100%';
      button.style.transition = 'all 0.2s';

      if (btn.style === 'destructive') {
        button.style.backgroundColor = '#FEF2F2';
        button.style.color = '#DC2626';
        button.style.border = '1px solid #FCA5A5';
      } else if (btn.style === 'cancel') {
        button.style.backgroundColor = '#F8FAFC';
        button.style.color = '#64748B';
        button.style.border = '1px solid #E2E8F0';
      } else {
        button.style.backgroundColor = '#15803D';
        button.style.color = '#FFFFFF';
      }

      button.onclick = () => {
        document.body.removeChild(overlay);
        if (btn.onPress) btn.onPress();
      };

      btnContainer.appendChild(button);
    });

    box.appendChild(titleEl);
    if (message) box.appendChild(msgEl);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  };
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppNavigator);

