import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { colors } from '../../../../shared/design-system';
import {
  ok,
  fail,
  networkError,
  type FakeResponse,
  type FakeServer,
} from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import type { JoinTarget } from '../model';
import {
  OrganizationErrorCode,
  parseParticipationRequest,
  PARTICIPATION_REQUESTS_PATH,
} from '../participationApi';
import { participationRequestsKey } from '../participationQueries';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { RoleSelectScreen } from './RoleSelectScreen';

// 참여 요청은 가짜 서버(src/features/my/org/testing)가 답한다. 가입을 마친 계정이라 한빛 설비에 승인 대기 요청이 있다
const target = (
  companyCode = 'RBT124',
  organizationName = 'Orbit',
  requestChannel: JoinTarget['requestChannel'] = 'COMPANY_CODE',
): JoinTarget => ({
  organizationId: '9',
  organizationName,
  companyCode,
  requestChannel,
});

function renderRole(
  extra: Partial<Parameters<typeof RoleSelectScreen>[0]> = {},
) {
  const participation = createParticipationServer({
    requests: EXISTING_REQUESTS,
  });
  const props = {
    target: target(),
    onBack: jest.fn(),
    onRequested: jest.fn(),
    onAlreadyMember: jest.fn(),
    onPendingExists: jest.fn(),
    ...extra,
  };
  return renderWithApi(<RoleSelectScreen {...props} />, {
    server: participation.server,
    session: testSession(),
  }).then(view => ({ ...view, props }));
}

const submit = () => screen.getByRole('button', { name: '참여 요청하기' });
const requests = (server: FakeServer) =>
  server.callsTo('POST', PARTICIPATION_REQUESTS_PATH);
const header = (name: string) => screen.queryByRole('header', { name });

async function requestAs(type: '기사' | '직원') {
  await userEvent.press(
    screen.getByRole('radio', { name: new RegExp(`^${type}`) }),
  );
  await userEvent.press(submit());
}

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

  it('참여 요청하기를 누르면 회사 코드·고른 유형·찾은 경로(코드 입력)를 서버에 보내고, 만든 요청을 넘긴다', async () => {
    const { server, props } = await renderRole();

    await requestAs('직원');

    await waitFor(() => expect(props.onRequested).toHaveBeenCalledTimes(1));
    expect(requests(server)[0].body).toEqual({
      companyCode: 'RBT124',
      desiredType: 'STAFF',
      requestChannel: 'COMPANY_CODE',
    });
    expect(props.onRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: 'Orbit',
        desiredType: 'STAFF',
        status: 'PENDING',
        requestChannel: 'COMPANY_CODE',
      }),
    );
  });

  // QR(#108)·참여 링크로 찾은 회사도 같은 화면으로 요청한다
  it('다른 경로로 찾은 회사면 그 경로로 보낸다', async () => {
    const { server } = await renderRole({
      target: target('RBT124', 'Orbit', 'QR_CODE'),
    });

    await requestAs('기사');

    await waitFor(() => expect(requests(server)).toHaveLength(1));
    expect(requests(server)[0].body).toMatchObject({
      requestChannel: 'QR_CODE',
    });
  });

  it('보내는 동안에는 버튼이 잠기고, 연달아 눌러도 한 번만 요청한다', async () => {
    const { server, props } = await renderRole();
    let release: (response: FakeResponse) => void = () => {};
    server.on(
      'POST',
      PARTICIPATION_REQUESTS_PATH,
      () =>
        new Promise<FakeResponse>(done => {
          release = done;
        }),
    );

    await userEvent.press(screen.getByRole('radio', { name: /^기사/ }));
    await fireEvent.press(submit());
    await fireEvent.press(submit());

    // 보내는 중 상태는 서버 상태 캐시가 다음 틱에 알린다
    await waitFor(() => expect(submit()).toBeDisabled());
    expect(requests(server)).toHaveLength(1);
    await act(async () => release(networkError()));
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(props.onRequested).not.toHaveBeenCalled();
  });

  it('이미 참여 중(409 ORGANIZATION-013)이면 이미 참여 안내를 띄우고, 확인하면 소속 쪽으로 보낸다', async () => {
    const { props } = await renderRole({
      target: target('BS0001', '오빗 서비스'),
    });

    await requestAs('기사');

    expect(
      await screen.findByRole('header', { name: '이미 참여 중인 회사예요' }),
    ).toBeOnTheScreen();
    expect(props.onAlreadyMember).not.toHaveBeenCalled();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(props.onAlreadyMember).toHaveBeenCalledTimes(1);
    expect(props.onRequested).not.toHaveBeenCalled();
  });

  it('승인 대기 요청이 있으면(409 ORGANIZATION-014) 승인 대기 안내를 띄우고, 확인하면 그 요청 쪽으로 보낸다', async () => {
    const { props } = await renderRole({
      target: target('HB0010', '한빛 설비'),
    });

    await requestAs('기사');

    expect(
      await screen.findByRole('header', {
        name: '이미 참여를 요청한 회사예요',
      }),
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(props.onPendingExists).toHaveBeenCalledTimes(1);
  });

  it('그사이 코드가 바뀌었으면(404 ORGANIZATION-012) 유효하지 않은 코드 안내 뒤 코드 입력으로 돌아간다', async () => {
    const { props } = await renderRole({
      target: target('PRV014', '새봄 설비'),
    });

    await requestAs('기사');

    expect(
      await screen.findByRole('header', {
        name: '유효하지 않은 회사 코드입니다',
      }),
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      '잠금 대기(409 ORGANIZATION-010)',
      fail(409, OrganizationErrorCode.lockTimeout),
      '잠시 후 다시 시도해 주세요',
    ],
    ['네트워크 오류', networkError(), '참여 요청을 보내지 못했어요'],
    ['서버 오류(500)', fail(500, 'COMMON-500'), '참여 요청을 보내지 못했어요'],
  ])(
    '%s 면 안내를 띄우고 화면에 머물러 다시 보낼 수 있다',
    async (_, response, title) => {
      const { server, props } = await renderRole();
      const created = server.on('POST', PARTICIPATION_REQUESTS_PATH, response);

      await requestAs('기사');
      expect(
        await screen.findByRole('header', { name: title }),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '확인' }));

      expect(header(title)).toBeNull();
      expect(header('역할을 선택해주세요')).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: /^기사/ })).toBeChecked();
      expect(submit()).toBeEnabled();
      expect(props.onRequested).not.toHaveBeenCalled();
      expect(props.onBack).not.toHaveBeenCalled();
      expect(created.callsTo('POST', PARTICIPATION_REQUESTS_PATH)).toHaveLength(
        1,
      );
    },
  );

  it('보내는 동안 화면을 떠나면 늦게 온 결과로 요청 완료에 데려가지 않는다', async () => {
    const { server, props, unmount } = await renderRole();
    let release: () => void = () => {};
    server.on(
      'POST',
      PARTICIPATION_REQUESTS_PATH,
      () =>
        new Promise<FakeResponse>(done => {
          // 서버는 요청을 만들어 성공으로 답한다 (화면이 남아 있었다면 요청 완료로 갔을 응답)
          release = () =>
            done(
              ok({
                requestId: 31,
                organizationId: 9,
                organizationName: 'Orbit',
                desiredType: 'TECHNICIAN',
                status: 'PENDING',
                requestedAt: '2026-11-04T01:24:00Z',
              }),
            );
        }),
    );
    await requestAs('기사');
    expect(requests(server)).toHaveLength(1);

    await unmount();
    await act(async () => release());

    expect(props.onRequested).not.toHaveBeenCalled();
  });

  // 화면 이동은 화면의 몫이지만, 서버가 만든 요청을 신청 현황에 반영하는 일은 화면이 사라져도 일어나야 한다
  it('보내는 동안 화면을 떠나도 서버가 만든 요청은 받아 둔 신청 현황에 반영되고 다시 받을 대상이 된다', async () => {
    const { server, unmount, queryClient } = await renderRole();
    queryClient.setQueryData(
      participationRequestsKey,
      EXISTING_REQUESTS.map(parseParticipationRequest),
    );
    let release: () => void = () => {};
    server.on(
      'POST',
      PARTICIPATION_REQUESTS_PATH,
      () =>
        new Promise<FakeResponse>(done => {
          release = () =>
            done(
              ok({
                requestId: 31,
                organizationId: 9,
                organizationName: 'Orbit',
                desiredType: 'TECHNICIAN',
                status: 'PENDING',
                requestedAt: '2026-11-04T01:24:00Z',
              }),
            );
        }),
    );
    await requestAs('기사');

    await unmount();
    await act(async () => release());

    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<{ requestId: string }[]>(participationRequestsKey)
          ?.map(item => item.requestId),
      ).toContain('31'),
    );
    expect(
      queryClient.getQueryState(participationRequestsKey)?.isInvalidated,
    ).toBe(true);
  });

  // 갈 곳을 서버에 묻는 동안(온보딩: 신청 현황 다시 받기) 다시 보내지 않게 한다
  it('안내를 닫은 뒤 갈 곳을 찾는 동안 참여 요청하기가 잠긴다', async () => {
    let done: () => void = () => {};
    const onAlreadyMember = jest.fn(
      () =>
        new Promise<void>(resolve => {
          done = resolve;
        }),
    );
    await renderRole({
      target: target('BS0001', '오빗 서비스'),
      onAlreadyMember,
    });
    await requestAs('기사');
    await screen.findByRole('header', { name: '이미 참여 중인 회사예요' });

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(onAlreadyMember).toHaveBeenCalledTimes(1);
    expect(submit()).toBeDisabled();
    await act(async () => done());
    expect(submit()).toBeEnabled();
  });

  // 다른 탭으로 옮긴 동안 실패 응답이 오면 RN Modal 이 그 탭 위에 뜬다
  it('화면이 보이지 않는 동안 온 실패 안내는 띄우지 않고, 돌아오면 띄운다', async () => {
    const { server, props, rerender } = await renderRole({
      screenFocused: false,
    });
    server.on('POST', PARTICIPATION_REQUESTS_PATH, networkError());

    await requestAs('기사');
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(header('참여 요청을 보내지 못했어요')).toBeNull();

    await rerender(<RoleSelectScreen {...props} screenFocused />);

    expect(
      screen.getByRole('header', { name: '참여 요청을 보내지 못했어요' }),
    ).toBeOnTheScreen();
  });

  it('온보딩에서는 머리 제목이 참여 요청이다 (#85)', async () => {
    await renderRole({ flow: 'onboarding' });

    expect(screen.getByRole('header', { name: '참여 요청' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});
