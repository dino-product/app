import { useState } from 'react';
import { measureRenders } from 'reassure';
import { mockAppState } from '../../../../../jest/appState';
import { scanQr } from '../../../../../jest/qrCamera';
import { ApiProvider } from '../../../../shared/api';
import { perfBudget } from '../../../../shared/perf/budget';
import { createTestApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { QrScanScreen } from './QrScanScreen';

// 렌더마다 새 기기(서버·캐시)로 연다. 카메라는 jest/qrCamera 의 목이다 (#108)
function Scan() {
  const [api] = useState(() =>
    createTestApi({
      server: createParticipationServer({ requests: EXISTING_REQUESTS }).server,
      session: testSession(),
    }),
  );
  return (
    <ApiProvider client={api.client} queryClient={api.queryClient}>
      <QrScanScreen focused onClose={() => {}} onFound={() => {}} />
    </ApiProvider>
  );
}

describe('QrScanScreen 렌더 예산', () => {
  beforeEach(() => {
    mockAppState('active');
  });

  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(<Scan />);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // 카메라는 QR 이 보이는 동안 프레임마다 같은 값을 보낸다. 처음 한 번만 화면을 바꾸고 나머지 프레임은 다시 그리지 않는다
  it('같은 QR 이 프레임마다 와도 처음 한 번만 다시 그린다', async () => {
    const result = await measureRenders(<Scan />, {
      scenario: async () => {
        for (let frame = 0; frame < 30; frame += 1) {
          await scanQr('WIFI:S:office;T:WPA;P:secret;;');
        }
      },
    });

    // 마운트 1 + 인식할 수 없는 QR 안내 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
