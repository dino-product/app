import { useMutation, useQuery } from '@tanstack/react-query';
import {
  renderHook,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useApiClient } from '../api';
import { createFakeServer, fail, ok } from './fakeServer';
import {
  createTestApi,
  createTestQueryClient,
  renderWithApi,
} from './renderWithApi';
import { testSession } from './session';

function Memberships() {
  const api = useApiClient();
  const { data, error } = useQuery({
    queryKey: ['memberships'],
    queryFn: ({ signal }) =>
      api.get<string[]>('/api/v1/memberships', { signal }),
  });
  if (error) {
    return <Text>{error.message}</Text>;
  }
  return <Text>{data?.join(', ') ?? '불러오는 중'}</Text>;
}

describe('renderWithApi', () => {
  it('가짜 서버의 응답으로 화면을 그린다', async () => {
    const server = createFakeServer().on(
      'GET',
      '/api/v1/memberships',
      ok(['오르빗 설비']),
    );

    await renderWithApi(<Memberships />, { server, session: testSession() });

    expect(await screen.findByText('오르빗 설비')).toBeOnTheScreen();
    expect(server.calls[0].headers.Authorization).toBe('Bearer access-1');
  });

  it('조회를 다시 시도하지 않아 오류가 바로 보인다', async () => {
    const server = createFakeServer().on(
      'GET',
      '/api/v1/memberships',
      fail(500, 'COMMON-500', { message: '서버 오류가 발생했습니다.' }),
    );

    await renderWithApi(<Memberships />, { server, session: testSession() });

    expect(
      await screen.findByText('서버 오류가 발생했습니다.'),
    ).toBeOnTheScreen();
    expect(server.calls).toHaveLength(1);
  });

  it('세션 없이 시작하면 저장소가 비어 있다', async () => {
    const { tokenStore, server } = await renderWithApi(<Text>빈 화면</Text>);

    await expect(tokenStore.read()).resolves.toBeNull();
    expect(server.calls).toHaveLength(0);
  });

  it('wrapper 로 훅을 시험하고, 변경 요청도 다시 시도하지 않는다', async () => {
    const api = createTestApi({ session: testSession() });
    api.server.on('POST', '/api/v1/participation-requests', fail(500, 'X'));
    const { result } = await renderHook(
      () => {
        const client = useApiClient();
        return useMutation({
          mutationFn: () => client.post('/api/v1/participation-requests', {}),
        });
      },
      { wrapper: api.wrapper },
    );

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.server.calls).toHaveLength(1);
  });

  it('테스트용 QueryClient 는 조회·변경 요청 재시도를 끈다', () => {
    const defaults = createTestQueryClient().getDefaultOptions();

    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it('누르는 화면도 그대로 시험한다', async () => {
    const server = createFakeServer().on(
      'POST',
      '/api/v1/participation-requests/7/cancel',
      ok(),
    );
    function Cancel() {
      const client = useApiClient();
      const { mutate, isSuccess } = useMutation({
        mutationFn: () =>
          client.post('/api/v1/participation-requests/7/cancel'),
      });
      return (
        <Pressable accessibilityRole="button" onPress={() => mutate()}>
          <Text>{isSuccess ? '취소됨' : '신청 취소'}</Text>
        </Pressable>
      );
    }
    await renderWithApi(<Cancel />, { server, session: testSession() });

    await userEvent.press(screen.getByRole('button', { name: '신청 취소' }));

    expect(await screen.findByText('취소됨')).toBeOnTheScreen();
  });
});
