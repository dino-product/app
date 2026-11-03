import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { iconSvgs } from '../design-system/icons/svgs';
import { mainTabs } from './mainTabs';

const historyXml = async (active: boolean) => {
  const history = mainTabs.find(tab => tab.key === 'history');
  if (!history) {
    throw new Error('작업 이력 탭이 없습니다');
  }
  await render(
    <View testID="tab">
      {history.renderIcon({ active, color: '#000000' })}
    </View>,
  );
  const [iconView] = screen.getByTestId('tab', {
    includeHiddenElements: true,
  }).children;
  const [svg] = typeof iconView === 'string' ? [] : iconView.children;
  if (svg === undefined || typeof svg === 'string') {
    throw new Error('SVG 뷰가 없습니다');
  }
  return svg.props.xml as string;
};

describe('mainTabs — 작업 이력', () => {
  it('선택되면 화살표가 있는 채운 시계(tab-history-active)를 그린다', async () => {
    expect(await historyXml(true)).toBe(iconSvgs['tab-history-active'].xml);
  });

  it('선택되지 않으면 테두리 화살표 시계(tab-history)를 그린다', async () => {
    expect(await historyXml(false)).toBe(iconSvgs['tab-history'].xml);
  });
});
