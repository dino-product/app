import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { colors } from '../../../../shared/design-system';
import { RoleSelectScreen } from './RoleSelectScreen';

const renderRole = (onSubmit = jest.fn()) =>
  render(
    <RoleSelectScreen
      organizationName="Orbit"
      onBack={jest.fn()}
      onSubmit={onSubmit}
    />,
  );

const submit = () => screen.getByRole('button', { name: '참여 요청하기' });

describe('RoleSelectScreen', () => {
  it('회사명과 참여 유형 두 개, 희망 유형 안내를 보여준다', async () => {
    await renderRole();

    expect(
      screen.getByRole('header', { name: '역할을 선택해주세요' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Orbit')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getByText(
        '선택한 유형은 희망 유형이에요. 최종 유형은 사무실에서 승인할 때 확정돼요.',
      ),
    ).toBeOnTheScreen();
  });

  it('유형을 고르기 전에는 참여 요청하기가 비활성이다', async () => {
    await renderRole();

    expect(submit()).toBeDisabled();
  });

  // 스크린리더는 "기사, 라디오 버튼, 선택됨, 2개 중 2번째" 처럼 읽는다
  it('두 카드는 라디오 그룹이고 고른 카드만 선택 상태다', async () => {
    await renderRole();

    // 그룹은 자식 라디오를 하나씩 읽어야 해서 접근성 요소가 아닌 컨테이너다
    const technician = screen.getByRole('radio', { name: /^기사/ });
    expect(technician.parent).toHaveProp('accessibilityRole', 'radiogroup');
    await userEvent.press(technician);

    expect(technician).toBeChecked();
    expect(screen.getByRole('radio', { name: /^직원/ })).not.toBeChecked();
    expect(technician).toHaveStyle({
      borderColor: colors.secondary,
      backgroundColor: colors.select[1],
    });
    expect(submit()).toBeEnabled();
  });

  it('카드 이름에 설명을 붙여 읽는다', async () => {
    await renderRole();

    expect(
      screen.getByRole('radio', {
        name: '직원, 사무실에서 작업을 등록하고 기사에게 배정해요',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', {
        name: '기사, 배정된 현장 작업을 수락하고 수행·보고해요',
      }),
    ).toBeOnTheScreen();
  });

  // RN 은 라디오 그룹의 이름·위치("2개 중 2번째")를 플랫폼에 넘기지 않아 힌트로 읽는다
  it('라디오마다 그룹 이름과 위치를 힌트로 붙인다', async () => {
    await renderRole();

    expect(screen.getByRole('radio', { name: /^직원/ })).toHaveProp(
      'accessibilityHint',
      '참여 유형, 2개 중 1번째',
    );
    expect(screen.getByRole('radio', { name: /^기사/ })).toHaveProp(
      'accessibilityHint',
      '참여 유형, 2개 중 2번째',
    );
  });

  it('참여 요청하기를 연달아 눌러도 한 번만 요청한다', async () => {
    const onSubmit = jest.fn();
    await renderRole(onSubmit);

    await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
    await fireEvent.press(submit());
    await fireEvent.press(submit());

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('참여 요청하기를 누르면 고른 유형으로 요청한다', async () => {
    const onSubmit = jest.fn();
    await renderRole(onSubmit);

    await userEvent.press(screen.getByRole('radio', { name: /^직원/ }));
    await userEvent.press(submit());

    expect(onSubmit).toHaveBeenCalledWith('STAFF');
  });
});
