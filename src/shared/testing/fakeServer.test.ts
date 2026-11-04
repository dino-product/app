import {
  createFakeServer,
  fail,
  FAKE_NO_ROUTE_CODE,
  hang,
  noContent,
  ok,
  verifyFakeServers,
} from './fakeServer';

describe('가짜 서버', () => {
  it('경로·메서드별 응답을 차례로 주고 마지막 응답을 되풀이한다', async () => {
    const server = createFakeServer().on(
      'GET',
      '/api/v1/memberships',
      ok(['처음']),
      ok(['다음']),
    );
    const read = async () =>
      JSON.parse(
        await (
          await server.fetch(`${server.baseUrl}/api/v1/memberships`)
        ).text(),
      ).result;

    expect([await read(), await read(), await read()]).toEqual([
      ['처음'],
      ['다음'],
      ['다음'],
    ]);
  });

  it('받은 요청의 메서드·경로·쿼리·헤더·본문을 남긴다', async () => {
    const server = createFakeServer().on(
      'POST',
      '/api/v1/participation-requests',
      ok({ requestId: 1 }),
    );

    await server.fetch(
      `${server.baseUrl}/api/v1/participation-requests?from=a%26b`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
        body: JSON.stringify({ organizationId: 3 }),
      },
    );

    expect(server.callsTo('POST', '/api/v1/participation-requests')).toEqual([
      expect.objectContaining({
        query: { from: 'a&b' },
        headers: { Authorization: 'Bearer t' },
        body: { organizationId: 3 },
      }),
    ]);
  });

  it('함수 응답은 받은 요청을 보고 답한다', async () => {
    const server = createFakeServer().on('GET', '/api/v1/auth/me', call =>
      call.headers.Authorization
        ? ok({ accountId: 1 })
        : fail(401, 'COMMON-401'),
    );

    const response = await server.fetch(`${server.baseUrl}/api/v1/auth/me`);

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('204 는 본문이 없다', async () => {
    const server = createFakeServer().on(
      'DELETE',
      '/api/v1/push-devices/1',
      noContent(),
    );

    const response = await server.fetch(
      `${server.baseUrl}/api/v1/push-devices/1`,
      { method: 'DELETE' },
    );

    expect(response.ok).toBe(true);
    await expect(response.text()).resolves.toBe('');
  });

  it('정하지 않은 경로는 501 FAKE-NO-ROUTE 로 답하고 처리 못 한 요청으로 남긴다', async () => {
    const server = createFakeServer();

    const response = await server.fetch(`${server.baseUrl}/api/v1/nothing`);

    expect(response.status).toBe(501);
    expect(JSON.parse(await response.text())).toMatchObject({
      success: false,
      code: FAKE_NO_ROUTE_CODE,
      message: '가짜 서버에 없는 경로: GET /api/v1/nothing',
    });
    expect(server.takeUnhandled()).toEqual(['GET /api/v1/nothing']);
    expect(server.takeUnhandled()).toEqual([]);
  });

  it('가짜 서버 밖의 주소도 처리 못 한 요청으로 남긴다', async () => {
    const server = createFakeServer();

    const response = await server.fetch('https://elsewhere.test/a', {
      method: 'POST',
    });

    expect(response.status).toBe(501);
    expect(server.takeUnhandled()).toEqual(['POST https://elsewhere.test/a']);
  });

  it('처리 못 한 요청이 남은 채 테스트가 끝나면 실패시킨다 (jest/setupAfterEnv 가 테스트마다 부른다)', async () => {
    const server = createFakeServer();
    await server.fetch(`${server.baseUrl}/api/v1/membership`);

    expect(() => verifyFakeServers()).toThrow('GET /api/v1/membership');
    // 한 번 알리면 비운다
    expect(() => verifyFakeServers()).not.toThrow();
  });

  it('이미 취소된 signal 이면 보내지 않고 바로 취소로 끝낸다', async () => {
    const server = createFakeServer().on('GET', '/api/v1/memberships', hang());
    const controller = new AbortController();
    controller.abort();

    await expect(
      server.fetch(`${server.baseUrl}/api/v1/memberships`, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(server.calls).toHaveLength(0);
  });
});
