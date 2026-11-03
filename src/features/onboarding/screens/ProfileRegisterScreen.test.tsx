import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { ProfileRegisterScreen } from './ProfileRegisterScreen';

const renderRegister = async () => {
  const props = { onBack: jest.fn(), onSubmit: jest.fn() };
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

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderRegister();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalled();
  });
});
