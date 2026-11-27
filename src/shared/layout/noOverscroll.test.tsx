import type { ReactElement } from 'react';
import {
  blockedScreens,
  refreshableScreens,
  renderAppScreen,
} from '../testing/appScreens';

// 새로고침이 없는 화면은 맨 위에서 아래로 끌어도 내용이 내려오지 않는다 (#103).
// 시트·모달 안의 스크롤(약관 시트 등)은 범위 밖이라 화면 본문의 첫 스크롤 뷰만 본다

async function firstScrollView(element: ReactElement) {
  const container = await renderAppScreen(element);
  const [scroll] = container.queryAll(node => node.type === 'RCTScrollView');
  expect(scroll).toBeDefined();
  return scroll;
}

describe('위로 끌리는 스크롤 (iOS 바운스 · Android 오버스크롤)', () => {
  it.each(blockedScreens)('%s: 막는다', async (_, element) => {
    const scroll = await firstScrollView(element);

    expect(scroll.props.bounces).toBe(false);
    expect(scroll.props.overScrollMode).toBe('never');
  });

  it.each(refreshableScreens)(
    '%s: 새로고침 자리라 그대로 둔다',
    async (_, element) => {
      const scroll = await firstScrollView(element);

      expect(scroll.props.bounces).not.toBe(false);
      expect(scroll.props.overScrollMode).not.toBe('never');
    },
  );
});
