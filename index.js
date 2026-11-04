/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { setUpBackgroundPush } from './src/features/push/push';
import { name as appName } from './app.json';

// 앱 푸시 (#118). 백그라운드 메시지 처리기는 앱을 그리기 전에 둔다
setUpBackgroundPush();

AppRegistry.registerComponent(appName, () => App);
