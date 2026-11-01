import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
import { currentWork, weeklySchedule } from '../mockData';
import { WorkHomeScreen } from './WorkHomeScreen';

describe('WorkHomeScreen 터치 영역', () => {
  it('알림 버튼은 26 종 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <WorkHomeScreen
        currentWork={currentWork}
        schedule={weeklySchedule}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={jest.fn()}
        onOpenWork={jest.fn()}
        onOpenNotifications={jest.fn()}
      />,
    );

    expectIconButtonTouchTarget(screen.getByRole('button', { name: '알림' }));
  });
});
