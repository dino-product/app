import { StatusBar, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkStyles : lightStyles;
  useFrameMonitor();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, theme.container]}>
        <Text accessibilityRole="header" style={[styles.title, theme.text]}>
          Dino
        </Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
});

const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF' },
  text: { color: '#111111' },
});

const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#000000' },
  text: { color: '#F5F5F5' },
});
