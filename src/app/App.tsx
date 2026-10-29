import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text } from '../shared/design-system';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkStyles : lightStyles;
  useFrameMonitor();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, theme.container]}>
        <Text accessibilityRole="header" variant="Title/S" style={theme.text}>
          Dino
        </Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

const lightStyles = StyleSheet.create({
  container: { backgroundColor: colors.gray[0] },
  text: { color: colors.gray[900] },
});

const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#000000' },
  text: { color: '#F5F5F5' },
});
