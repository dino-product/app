import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { colors } from '../../../shared/design-system';
import {
  fail,
  hang,
  networkError,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { PROFILE_RULE_MESSAGE } from '../model';
import {
  MY_PROFILE_PATH,
  myProfileResponse,
  myServer,
} from '../profileTesting';
import { ProfileEditScreen } from './ProfileEditScreen';

// 서버가 저장한 값을 그대로 돌려준다 (SaveProfileRequest → ProfileResponse)
const savingServer = () =>
  myServer().on('PUT', MY_PROFILE_PATH, call =>
    ok(myProfileResponse(call.body as Record<string, unknown>)),
  );

async function renderEdit(
  server: FakeServer = savingServer(),
  { onBack = jest.fn(), onSaved = jest.fn() } = {},
) {
  const view = await renderWithApi(
    <ProfileEditScreen onBack={onBack} onSaved={onSaved} />,
    { server, session: testSession() },
  );
  return { ...view, onBack, onSaved };
}

/** 프로필을 받아 입력칸이 채워질 때까지 기다린다 */
async function renderLoadedEdit(
  server?: FakeServer,
  callbacks?: Parameters<typeof renderEdit>[1],
) {
  const view = await renderEdit(server, callbacks);
  await screen.findByLabelText('이름');
  return view;
}

const nameInput = () => screen.getByLabelText('이름');
const phoneInput = () => screen.getByLabelText('연락처');
const saveButton = () => screen.getByRole('button', { name: '저장하기' });
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

/** 이름을 박기사로, 연락처를 010-9876-5432 로 바꾼다 */
async function editProfile() {
  await userEvent.clear(nameInput());
  await userEvent.type(nameInput(), ' 박기사 ');
  await userEvent.clear(phoneInput());
  await userEvent.type(phoneInput(), '01098765432');
}

describe('ProfileEditScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목과 서버의 지금 이름·연락처가 채워진 입력칸을 보여준다', async () => {
    await renderLoadedEdit();

    expect(
      screen.getByRole('header', { name: '프로필 수정' }),
    ).toBeOnTheScreen();
    expect(nameInput()).toHaveDisplayValue('김현진');
    expect(phoneInput()).toHaveDisplayValue('010-1234-5678');
  });

  it('입력칸은 비우면 Figma placeholder 를 보여준다', async () => {
    await renderLoadedEdit();

    expect(nameInput()).toHaveProp('placeholder', '김기사');
    expect(phoneInput()).toHaveProp('placeholder', '000-0000-0000');
  });

  it('입력칸에 포커스하면 보라 테두리, 벗어나면 회색 테두리가 된다', async () => {
    await renderLoadedEdit();

    expect(nameInput()).toHaveStyle({ borderColor: colors.gray[200] });
    await fireEvent(nameInput(), 'focus');
    expect(nameInput()).toHaveStyle({ borderColor: colors.secondary });
    expect(phoneInput()).toHaveStyle({ borderColor: colors.gray[200] });

    await fireEvent(nameInput(), 'blur');
    expect(nameInput()).toHaveStyle({ borderColor: colors.gray[200] });
  });

  it('연락처는 숫자 키패드로 받고, 숫자만 넣어도 하이픈을 넣어 보여준다', async () => {
    await renderLoadedEdit();

    expect(phoneInput()).toHaveProp('keyboardType', 'number-pad');
    await userEvent.clear(phoneInput());
    await userEvent.type(phoneInput(), '01098765432');

    expect(phoneInput()).toHaveDisplayValue('010-9876-5432');
  });

  it('바뀐 값이 없으면 저장하기가 비활성이다', async () => {
    await renderLoadedEdit();

    expect(saveButton()).toBeDisabled();
  });

  it('규칙에 맞지 않으면(이름 한 글자) 저장할 수 없다', async () => {
    await renderLoadedEdit();

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), '박');

    expect(saveButton()).toBeDisabled();
  });

  it('뒤로 가기는 onBack 을 부른다', async () => {
    const { onBack } = await renderLoadedEdit();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  describe('불러오기', () => {
    it('프로필을 받는 동안 진행 표시를 보이고 입력칸·저장하기는 아직 없다', async () => {
      await renderEdit(myServer().on('GET', MY_PROFILE_PATH, hang()));

      expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
      expect(screen.queryByLabelText('이름')).toBeNull();
      expect(screen.queryByRole('button', { name: '저장하기' })).toBeNull();
    });

    it('프로필을 받지 못하면 안내와 다시 시도를 보이고, 다시 시도로 받아 채운다', async () => {
      await renderEdit(
        savingServer().on(
          'GET',
          MY_PROFILE_PATH,
          networkError(),
          ok(myProfileResponse()),
        ),
      );

      expect(
        await screen.findByText('프로필을 불러오지 못했어요.'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      expect(await screen.findByLabelText('이름')).toHaveDisplayValue('김현진');
    });
  });

  describe('저장', () => {
    it('PUT 으로 앞뒤 공백을 지운 이름과 숫자만 남긴 연락처를 보내고, 성공하면 서버 프로필로 onSaved 를 부른다', async () => {
      const server = savingServer();
      const { onSaved } = await renderLoadedEdit(server);

      await editProfile();
      expect(saveButton()).toBeEnabled();
      await userEvent.press(saveButton());

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(server.callsTo('PUT', MY_PROFILE_PATH)[0].body).toEqual({
        name: '박기사',
        phoneNumber: '01098765432',
      });
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          name: '박기사',
          phoneNumber: '01098765432',
        }),
      );
    });

    it('저장하는 동안 저장하기가 꺼져 다시 눌러도 한 번만 보낸다', async () => {
      let answer: (response: FakeResponse) => void = () => {};
      const server = myServer().on(
        'PUT',
        MY_PROFILE_PATH,
        () =>
          new Promise<FakeResponse>(resolve => {
            answer = resolve;
          }),
      );
      const { onSaved } = await renderLoadedEdit(server);

      await editProfile();
      await userEvent.press(saveButton());
      await waitFor(() => expect(saveButton()).toBeDisabled());
      await userEvent.press(saveButton());
      expect(onSaved).not.toHaveBeenCalled();

      await act(async () => answer(ok(myProfileResponse({ name: '박기사' }))));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(server.callsTo('PUT', MY_PROFILE_PATH)).toHaveLength(1);
    });

    // 서버는 어느 칸이 틀렸는지 알려 주지 않는다
    it('PROFILE-001 이면 머물러 입력을 지키고 입력 규칙을 안내한다', async () => {
      const alert = spyAlert();
      const { onSaved } = await renderLoadedEdit(
        myServer().on('PUT', MY_PROFILE_PATH, fail(400, 'PROFILE-001')),
      );

      await editProfile();
      await userEvent.press(saveButton());

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '입력한 정보를 확인해 주세요',
          PROFILE_RULE_MESSAGE,
        ),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(nameInput()).toHaveDisplayValue(' 박기사 ');
      expect(phoneInput()).toHaveDisplayValue('010-9876-5432');
      expect(saveButton()).toBeEnabled();
    });

    it('COMMON-409(같은 계정을 동시에 저장) 이면 머물러 다시 시도해 달라고 안내한다', async () => {
      const alert = spyAlert();
      const { onSaved } = await renderLoadedEdit(
        myServer().on('PUT', MY_PROFILE_PATH, fail(409, 'COMMON-409')),
      );

      await editProfile();
      await userEvent.press(saveButton());

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '프로필을 저장하지 못했어요',
          '다른 곳에서 저장하는 중이었어요. 다시 시도해 주세요.',
        ),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(nameInput()).toHaveDisplayValue(' 박기사 ');
    });

    it('서버에 닿지 못하면 머물러 잠시 후 다시 시도해 달라고 안내한다', async () => {
      const alert = spyAlert();
      const { onSaved } = await renderLoadedEdit(
        myServer().on('PUT', MY_PROFILE_PATH, networkError()),
      );

      await editProfile();
      await userEvent.press(saveButton());

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '프로필을 저장하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(phoneInput()).toHaveDisplayValue('010-9876-5432');
    });
  });
});
