import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { ProfileRegisterScreen } from './ProfileRegisterScreen';

const renderRegister = async (
  overrides: Partial<Parameters<typeof ProfileRegisterScreen>[0]> = {},
) => {
  const props = { onBack: jest.fn(), onSubmit: jest.fn(), ...overrides };
  await render(<ProfileRegisterScreen {...props} />);
  return props;
};

const nameInput = () => screen.getByLabelText('이름');
const phoneInput = () => screen.getByLabelText('연락처');
const doneButton = () => screen.getByRole('button', { name: '완료' });

describe('ProfileRegisterScreen', () => {
  it('제목, 빈 입력칸과 Figma placeholder, 안내 문구를 보여준다', async () => {
    await renderRegister();

    expect(
      screen.getByRole('header', { name: '프로필 등록' }),
    ).toBeOnTheScreen();
    expect(nameInput()).toHaveDisplayValue('');
    expect(nameInput()).toHaveProp('placeholder', '김기사');
    expect(phoneInput()).toHaveProp('placeholder', '000-0000-0000');
    expect(
      screen.getByText('이름과 연락처는 작업 배정 및 팀 공유에 사용됩니다.'),
    ).toBeOnTheScreen();
  });

  it('처음에는 완료가 꺼져 있다', async () => {
    await renderRegister();

    expect(doneButton()).toBeDisabled();
  });

  it('이름만 넣거나 연락처가 모자라면 완료가 꺼져 있다', async () => {
    await renderRegister();

    await userEvent.type(nameInput(), '박기사');
    expect(doneButton()).toBeDisabled();

    await userEvent.type(phoneInput(), '0101234567');
    expect(doneButton()).toBeDisabled();
  });

  it('이름이 한 글자면 연락처를 다 넣어도 완료가 꺼져 있다', async () => {
    await renderRegister();

    await userEvent.type(nameInput(), '박');
    await userEvent.type(phoneInput(), '01012345678');

    expect(doneButton()).toBeDisabled();
  });

  it('연락처에 숫자만 넣어도 010-1234-5678 로 보인다', async () => {
    await renderRegister();

    expect(phoneInput()).toHaveProp('keyboardType', 'number-pad');
    await userEvent.type(phoneInput(), '01012345678');

    expect(phoneInput()).toHaveDisplayValue('010-1234-5678');
  });

  it('이름과 연락처를 모두 넣으면 완료가 켜지고, 누르면 다듬은 이름과 숫자만 넘긴다', async () => {
    const { onSubmit } = await renderRegister();

    await userEvent.type(nameInput(), ' 박기사 ');
    await userEvent.type(phoneInput(), '01012345678');
    expect(doneButton()).toBeEnabled();
    await userEvent.press(doneButton());

    expect(onSubmit).toHaveBeenCalledWith({
      name: '박기사',
      phoneNumber: '01012345678',
    });
  });

  it('입력칸은 Figma 대로 높이 50, 모서리 12 다', async () => {
    await renderRegister();

    expect(nameInput()).toHaveStyle({ minHeight: 50, borderRadius: 12 });
    expect(phoneInput()).toHaveStyle({ minHeight: 50, borderRadius: 12 });
  });

  it('입력칸에 포커스하면 보라 테두리가 된다', async () => {
    await renderRegister();

    expect(nameInput()).toHaveStyle({ borderColor: colors.gray[200] });
    await fireEvent(nameInput(), 'focus');
    expect(nameInput()).toHaveStyle({ borderColor: colors.secondary });
  });

  // 가입을 마치지 않은 계정이 다시 로그인한 경우 (#113)
  it('서버에 입력해 둔 이름·연락처가 있으면 채워서 열고 완료가 켜진다', async () => {
    const { onSubmit } = await renderRegister({
      initialProfile: { name: '홍길동', phoneNumber: '01012345678' },
    });

    expect(nameInput()).toHaveDisplayValue('홍길동');
    expect(phoneInput()).toHaveDisplayValue('010-1234-5678');
    await userEvent.press(doneButton());
    expect(onSubmit).toHaveBeenCalledWith({
      name: '홍길동',
      phoneNumber: '01012345678',
    });
  });

  // 켠 직후 뒤에서 확인한 프로필이 화면을 그린 뒤에 온 경우 (#113 낙관적 복원). 화면을 다시 만들지 않고 채운다
  it('입력해 둔 값이 늦게 오면 아직 고치지 않았을 때만 채운다', async () => {
    const props = { onBack: jest.fn(), onSubmit: jest.fn() };
    await render(<ProfileRegisterScreen {...props} />);
    const name = nameInput();

    await screen.rerender(
      <ProfileRegisterScreen
        {...props}
        initialProfile={{ name: '홍길동', phoneNumber: '01012345678' }}
      />,
    );

    expect(nameInput()).toBe(name);
    expect(nameInput()).toHaveDisplayValue('홍길동');
    expect(phoneInput()).toHaveDisplayValue('010-1234-5678');
  });

  it('이미 고쳤으면 늦게 온 값으로 덮어쓰지 않는다 (저장한 뒤 같은 값이 와도 그대로다)', async () => {
    const props = { onBack: jest.fn(), onSubmit: jest.fn() };
    await render(<ProfileRegisterScreen {...props} />);
    await userEvent.type(nameInput(), '박기사');

    await screen.rerender(
      <ProfileRegisterScreen
        {...props}
        initialProfile={{ name: '홍길동', phoneNumber: '01012345678' }}
      />,
    );

    expect(nameInput()).toHaveDisplayValue('박기사');
    expect(phoneInput()).toHaveDisplayValue('');
  });

  it('서버에 저장하는 동안에는 완료가 꺼져 있다', async () => {
    await renderRegister({
      initialProfile: { name: '홍길동', phoneNumber: '01012345678' },
      submitting: true,
    });

    expect(doneButton()).toBeDisabled();
  });

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderRegister();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalled();
  });
});
