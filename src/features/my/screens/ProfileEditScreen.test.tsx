import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { ProfileEditScreen } from './ProfileEditScreen';

const saved = { name: '김현진', phoneNumber: '01012345678' };

const renderEdit = (
  overrides: Partial<Parameters<typeof ProfileEditScreen>[0]> = {},
) =>
  render(
    <ProfileEditScreen
      profile={saved}
      onBack={jest.fn()}
      onSave={jest.fn()}
      {...overrides}
    />,
  );

const nameInput = () => screen.getByLabelText('이름');
const phoneInput = () => screen.getByLabelText('연락처');
const saveButton = () => screen.getByRole('button', { name: '저장하기' });

describe('ProfileEditScreen', () => {
  it('제목과 지금 이름·연락처가 채워진 입력칸을 보여준다', async () => {
    await renderEdit();

    expect(
      screen.getByRole('header', { name: '프로필 수정' }),
    ).toBeOnTheScreen();
    expect(nameInput()).toHaveDisplayValue('김현진');
    expect(phoneInput()).toHaveDisplayValue('010-1234-5678');
  });

  it('입력칸은 비우면 Figma placeholder 를 보여준다', async () => {
    await renderEdit();

    expect(nameInput()).toHaveProp('placeholder', '김기사');
    expect(phoneInput()).toHaveProp('placeholder', '000-0000-0000');
  });

  it('입력칸에 포커스하면 보라 테두리, 벗어나면 회색 테두리가 된다', async () => {
    await renderEdit();

    expect(nameInput()).toHaveStyle({ borderColor: colors.gray[200] });
    await fireEvent(nameInput(), 'focus');
    expect(nameInput()).toHaveStyle({ borderColor: colors.secondary });
    expect(phoneInput()).toHaveStyle({ borderColor: colors.gray[200] });

    await fireEvent(nameInput(), 'blur');
    expect(nameInput()).toHaveStyle({ borderColor: colors.gray[200] });
  });

  it('연락처는 숫자 키패드로 받고, 숫자만 넣어도 하이픈을 넣어 보여준다', async () => {
    await renderEdit();

    expect(phoneInput()).toHaveProp('keyboardType', 'number-pad');
    await userEvent.clear(phoneInput());
    await userEvent.type(phoneInput(), '01098765432');

    expect(phoneInput()).toHaveDisplayValue('010-9876-5432');
  });

  it('바뀐 값이 없으면 저장하기가 비활성이다', async () => {
    await renderEdit();

    expect(saveButton()).toBeDisabled();
  });

  it('올바르게 바꾸면 저장하기가 켜지고, 연락처는 숫자만 넘긴다', async () => {
    const onSave = jest.fn();
    await renderEdit({ onSave });

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), ' 박기사 ');
    await userEvent.clear(phoneInput());
    await userEvent.type(phoneInput(), '01098765432');
    expect(saveButton()).toBeEnabled();
    await userEvent.press(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      name: '박기사',
      phoneNumber: '01098765432',
    });
  });

  it('규칙에 맞지 않으면(이름 한 글자) 저장할 수 없다', async () => {
    await renderEdit();

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), '박');

    expect(saveButton()).toBeDisabled();
  });

  it('뒤로 가기는 onBack 을 부른다', async () => {
    const onBack = jest.fn();
    await renderEdit({ onBack });

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
