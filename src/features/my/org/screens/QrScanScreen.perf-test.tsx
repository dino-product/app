import { measureRenders } from 'reassure';
import { mockAppState } from '../../../../../jest/appState';
import { scanQr } from '../../../../../jest/qrCamera';
import { perfBudget } from '../../../../shared/perf/budget';
import { QrScanScreen } from './QrScanScreen';

// 카메라는 jest/qrCamera 의 목이다 (#108). 회사 확인은 돌아간 회사 찾기가 하므로(#195) 서버 없이 그린다
const noop = () => {};
const scan = <QrScanScreen focused onClose={noop} onScanned={noop} />;

describe('QrScanScreen 렌더 예산', () => {
  beforeEach(() => {
    mockAppState('active');
  });

  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(scan);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // 카메라는 QR 이 보이는 동안 프레임마다 같은 값을 보낸다. 처음 한 번만 화면을 바꾸고 나머지 프레임은 다시 그리지 않는다
  it('같은 QR 이 프레임마다 와도 처음 한 번만 다시 그린다', async () => {
    const result = await measureRenders(scan, {
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

  // 회사 코드를 읽으면 카메라를 끄는 한 번만 다시 그린다. 화면이 닫히는 동안 온 프레임은 그리지 않는다 (#195)
  it('회사 QR 을 읽은 뒤 프레임이 더 와도 카메라를 끄는 한 번만 다시 그린다', async () => {
    const result = await measureRenders(scan, {
      scenario: async () => {
        for (let frame = 0; frame < 30; frame += 1) {
          await scanQr('https://orbit.example/join/RBT124');
        }
      },
    });

    // 마운트 1 + 카메라 끔 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
