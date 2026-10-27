import { render, screen } from '@testing-library/react-native';
import App from './App';

describe('App', () => {
  it('홈 화면에 앱 이름을 헤더로 보여준다', async () => {
    await render(<App />);

    expect(screen.getByRole('header', { name: 'Dino' })).toBeOnTheScreen();
  });
});
